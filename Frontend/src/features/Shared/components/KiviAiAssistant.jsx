import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAuth } from '../../Auth/hooks/useAuth';
import { 
    streamAssistantChatApi, 
    rewriteResumeSection,
    getAssistantHistoryApi,
    clearAssistantHistoryApi 
} from '../../Interview/services/interview.api';
import { parseAndSanitizeSnippet } from '../../Interview/utils/sanitizeResumeHtml';
import { TrackUpdatePart } from '../../Interview/utils/trackUpdatePart';
import { MultiToolStatusStrip, ToolResourceCard } from '../../../UI';
import './KiviAiAssistant.scss';

// Configure marked options with custom link renderer for safe external links
const renderer = new marked.Renderer();
renderer.link = (href, title, text) => {
    let targetHref = typeof href === 'object' ? href.href : href;
    let targetTitle = typeof href === 'object' ? (href.title || '') : (title || '');
    let targetText = typeof href === 'object' ? href.text : text;
    if (!targetHref || typeof targetHref !== 'string' || !targetHref.startsWith('http')) {
        return targetText || '';
    }
    return `<a href="${targetHref}" target="_blank" rel="noopener noreferrer"${targetTitle ? ` title="${targetTitle}"` : ''}>${targetText}</a>`;
};

marked.setOptions({
    breaks: true,
    gfm: true
});
marked.use({ renderer });

/**
 * Auto-closes incomplete markdown tags during live streaming.
 * Prevents broken layout structure, unstyled code fences, or flickering text before closing tokens arrive.
 */
function autoCloseMarkdown(content = '') {
    if (!content) return '';
    let closed = content.replace(/<br\s*\/?>/gi, '\n');

    // 1. Auto-close code blocks (```)
    const codeBlockCount = (closed.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
        closed += '\n```';
    }

    // 2. Auto-close inline code (`)
    const outsideCodeBlocks = closed.replace(/```[\s\S]*?```/g, '');
    const inlineCodeCount = (outsideCodeBlocks.match(/`/g) || []).length;
    if (inlineCodeCount % 2 !== 0) {
        closed += '`';
    }

    // 3. Auto-close bold (** or __)
    const boldCount = (outsideCodeBlocks.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
        closed += '**';
    }

    return closed;
}

const renderMarkdown = (content, isStreaming = false) => {
    if (!content) return '';
    const safeContent = isStreaming ? autoCloseMarkdown(content) : content.replace(/<br\s*\/?>/gi, '\n');
    const rawHtml = marked.parse(safeContent);
    return DOMPurify.sanitize(rawHtml, {
        ADD_ATTR: ['target', 'rel']
    });
};

const DEFAULT_WIDTH = 410;
const DEFAULT_HEIGHT = 580;

const DEFAULT_WELCOME_MSG = {
    id: 1,
    sender: 'ai',
    text: '👋 Hi! I am KIVI, your AI Assistant. Highlight any text in your Resume or Cover Letter editor, then send me instructions or click quick presets to improve it!',
    isStreaming: false
};

const getChatStorageKey = (uid) => uid ? `kivi_chat_history_${uid}` : 'kivi_chat_history_guest';

/**
 * Memoized Chat Bubble Component
 * Prevents re-rendering and re-parsing markdown for already finished messages during streaming.
 * Displays only clean conversational assistant output (messageForUser) and verified learning resources.
 */
const ChatMessageBubble = React.memo(function ChatMessageBubble({ msg }) {
    // Memoize rendered HTML so static messages parse markdown only once
    const renderedHtml = useMemo(() => {
        return renderMarkdown(msg.text, msg.isStreaming);
    }, [msg.text, msg.isStreaming]);

    return (
        <div className={`chat-bubble-row ${msg.sender}`}>
            {msg.sender === 'ai' && (
                <img src="/Logo.png" alt="KIVI" className="chat-avatar-img" />
            )}
            <div className={`chat-bubble ${msg.sender}`}>
                {msg.highlightedContext && (
                    <div className="msg-context-quote">
                        📌 <em>"{msg.highlightedContext}"</em>
                    </div>
                )}
                {msg.sender === 'ai' ? (
                    msg.isStreaming && !msg.text ? (
                        msg.searchStatus ? (
                            <div className="kivi-searching-card">
                                <div className="searching-header">
                                    <span className="searching-radar-icon">
                                        <span className="radar-ping"></span>
                                        <span className="radar-core">🔍</span>
                                    </span>
                                    <div className="searching-header-info">
                                        <span className="searching-title">{msg.searchStatus.message || 'Searching web & developer resources...'}</span>
                                        {msg.searchStatus.query && (
                                            <span className="searching-query-tag">Query: {msg.searchStatus.query}</span>
                                        )}
                                    </div>
                                </div>
                                {Array.isArray(msg.searchStatus.sources) && msg.searchStatus.sources.length > 0 && (
                                    <div className="searching-sources-pills">
                                        {msg.searchStatus.sources.map((src, idx) => (
                                            <span key={idx} className="searching-source-pill">
                                                <span className="source-pill-icon">{src.icon || '🌐'}</span>
                                                <span className="source-pill-name">{src.name || src}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {Array.isArray(msg.searchStatus.scannedDomains) && msg.searchStatus.scannedDomains.length > 0 && (
                                    <div className="searching-scanned-domains">
                                        <span className="scanned-label">Scanning:</span>
                                        {msg.searchStatus.scannedDomains.map((dom, dIdx) => (
                                            <span key={dIdx} className="scanned-domain-tag">{dom}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="typing-dots-wrapper">
                                <span className="dot"></span>
                                <span className="dot"></span>
                                <span className="dot"></span>
                            </div>
                        )
                    ) : (
                        <div className="msg-content-wrapper">
                            {msg.isStreaming && msg.searchStatus && (
                                <MultiToolStatusStrip
                                    activeTools={msg.searchStatus.tools || []}
                                    statusMessage={msg.searchStatus.message}
                                />
                            )}
                            <div
                                className="msg-markdown-content"
                                dangerouslySetInnerHTML={{ __html: renderedHtml }}
                            />
                            {msg.isStreaming && <span className="streaming-cursor" />}

                            {/* Verified Resources & Links Panel */}
                            {Array.isArray(msg.resources) && msg.resources.length > 0 && (
                                <div className="verified-resources-panel">
                                    <div className="resources-title">
                                        <span>🔗</span>
                                        <span>Verified Resources & Learning Links</span>
                                    </div>
                                    <div className="resources-list-container">
                                        {msg.resources.map((res, rIdx) => (
                                            <ToolResourceCard
                                                key={`${res.url}-${rIdx}`}
                                                title={res.title}
                                                url={res.url}
                                                snippet={res.snippet}
                                                type={res.type}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                ) : (
                    <p className="msg-text">
                        {msg.text}
                    </p>
                )}
            </div>
        </div>
    );
});

export function KiviAiAssistant() {
    const { user, fetchUsage } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const isResumePage = location.pathname.startsWith('/resume/');
    const isCoverLetterPage = location.pathname.startsWith('/cover-letter/');
    const isEditorPage = isResumePage || isCoverLetterPage;
    const docTypeLabel = isCoverLetterPage ? 'Cover Letter' : 'Resume';

    const currentReportId = useMemo(() => {
        const m = location.pathname.match(/\/(?:interview|resume|cover-letter)\/([a-f0-9]{24})/i);
        return m ? m[1] : null;
    }, [location.pathname]);

    const [isKiviOpen, setIsKiviOpen] = useState(false);
    const [showIdleNudge, setShowIdleNudge] = useState(false);
    const [saveToast, setSaveToast] = useState(false);
    const idleTimerRef = useRef(null);
    const savedRangeRef = useRef(null);
    const abortControllerRef = useRef(null);
    const messagesContainerRef = useRef(null);

    // Smooth Word-by-Word Streaming Queue State Refs
    const streamQueueRef = useRef('');
    const displayedTextRef = useRef('');
    const streamTimerRef = useRef(null);
    const isStreamingDoneRef = useRef(false);
    const activeStreamAiMsgIdRef = useRef(null);
    const pendingDoneDataRef = useRef(null);

    // Resizable drawer dimensions & maximize state
    const [drawerSize, setDrawerSize] = useState(() => {
        try {
            const saved = localStorage.getItem('kivi_drawer_size');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.width && parsed.height) return parsed;
            }
        } catch (e) {}
        return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    });
    const [isMaximized, setIsMaximized] = useState(false);
    const isResizingRef = useRef(false);

    if (!user) {
        return null;
    }

    const [selectedSnippet, setSelectedSnippet] = useState('');
    const [appliedMsgIds, setAppliedMsgIds] = useState(new Set());
    const [rejectedMsgIds, setRejectedMsgIds] = useState(new Set());
    const [copiedMsgId, setCopiedMsgId] = useState(null);

    // Listen for Accept/Reject events originating from TipTap's in-canvas floating pill
    useEffect(() => {
        const handleDiffStatusChange = (e) => {
            const { status, msgId } = e.detail || {};
            if (status === 'accepted') {
                if (msgId) {
                    setAppliedMsgIds(prev => new Set(prev).add(msgId));
                } else {
                    setChatMessages(prev => {
                        const lastSnippetMsg = [...prev].reverse().find(m => m.suggestedSnippet && m.sender === 'ai');
                        if (lastSnippetMsg) {
                            setAppliedMsgIds(a => new Set(a).add(lastSnippetMsg.id));
                        }
                        return prev;
                    });
                }
            } else if (status === 'rejected') {
                if (msgId) {
                    setRejectedMsgIds(prev => new Set(prev).add(msgId));
                } else {
                    setChatMessages(prev => {
                        const lastSnippetMsg = [...prev].reverse().find(m => m.suggestedSnippet && m.sender === 'ai');
                        if (lastSnippetMsg) {
                            setRejectedMsgIds(r => new Set(r).add(lastSnippetMsg.id));
                        }
                        return prev;
                    });
                }
            }
        };

        window.addEventListener('kivi-diff-status-change', handleDiffStatusChange);
        return () => {
            window.removeEventListener('kivi-diff-status-change', handleDiffStatusChange);
        };
    }, []);

    const handleCopySnippet = useCallback((msgId, snippet) => {
        if (!snippet) return;
        navigator.clipboard.writeText(snippet);
        setCopiedMsgId(msgId);
        setTimeout(() => setCopiedMsgId(null), 2500);
    }, []);

    const handleOpenEditor = useCallback((reportId) => {
        if (reportId) navigate(`/resume/${reportId}`);
    }, [navigate]);

    const handleRejectSnippet = useCallback((msgId) => {
        if (msgId) {
            setRejectedMsgIds(prev => new Set(prev).add(msgId));
        }
        window.dispatchEvent(new CustomEvent('kivi-reject-diff', {
            detail: { msgId }
        }));
    }, []);

    // Chat messages initialized from persistent local storage
    const [chatMessages, setChatMessages] = useState(() => {
        try {
            const key = getChatStorageKey(user?._id);
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Error reading stored chat messages:', e);
        }
        return [DEFAULT_WELCOME_MSG];
    });
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);

    /**
     * Smart Smooth Auto-Scroll
     * Only auto-scrolls if the user is already near the bottom (within 120px)
     */
    const scrollToBottomIfNear = useCallback((force = false) => {
        const container = messagesContainerRef.current;
        if (!container) return;

        if (force) {
            container.scrollTop = container.scrollHeight;
            return;
        }

        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 140;
        if (isNearBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }, []);

    // Synchronize chat with user change or load remote history if local is empty
    useEffect(() => {
        try {
            const key = getChatStorageKey(user?._id);
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setChatMessages(parsed);
                    return;
                }
            }
        } catch (e) {}

        if (user?._id) {
            getAssistantHistoryApi().then(res => {
                if (res?.history && Array.isArray(res.history) && res.history.length > 0) {
                    const formatted = res.history.map((turn, idx) => ({
                        id: Date.now() - (res.history.length - idx) * 1000,
                        sender: turn.role === 'assistant' ? 'ai' : 'user',
                        text: turn.content,
                        isStreaming: false
                    }));
                    setChatMessages(prev => (prev.length <= 1 ? formatted : prev));
                }
            }).catch(() => {});
        }
    }, [user?._id]);

    // Automatically persist chat messages into localStorage whenever updated and not streaming
    useEffect(() => {
        const isStreamingActive = chatMessages.some(m => m.isStreaming);
        if (isStreamingActive) return;

        try {
            const key = getChatStorageKey(user?._id);
            const toSave = chatMessages.slice(-50).map(m => ({
                id: m.id,
                sender: m.sender,
                text: m.text,
                highlightedContext: m.highlightedContext || null,
                suggestedSnippet: m.suggestedSnippet || null,
                targetText: m.targetText || null,
                resources: m.resources || [],
                isStreaming: false
            }));
            localStorage.setItem(key, JSON.stringify(toSave));
        } catch (e) {
            console.warn('Error saving chat messages to localStorage:', e);
        }
    }, [chatMessages, user?._id]);

    // Clear entire chat session both locally and on the server
    const handleClearChatHistory = async () => {
        if (!window.confirm("Clear this chat history? This will start a fresh session.")) return;

        try {
            const key = getChatStorageKey(user?._id);
            localStorage.removeItem(key);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (streamTimerRef.current) {
                cancelAnimationFrame(streamTimerRef.current);
                streamTimerRef.current = null;
            }
            await clearAssistantHistoryApi();
        } catch (e) {
            console.warn('Error clearing backend history:', e);
        }

        setChatMessages([
            {
                id: Date.now(),
                sender: 'ai',
                text: '👋 Chat history cleared. How can I assist you with your resume or cover letter today?',
                isStreaming: false
            }
        ]);
        setAppliedMsgIds(new Set());
    };

    // Save and export current chat history to a clean markdown document
    const handleExportChatHistory = () => {
        try {
            const key = getChatStorageKey(user?._id);
            localStorage.setItem(key, JSON.stringify(chatMessages));

            const conversationText = chatMessages.map(m => {
                const author = m.sender === 'ai' ? '🤖 KIVI AI Assistant' : '👤 User';
                let block = `### ${author}\n\n${m.text || ''}`;
                if (m.highlightedContext) {
                    block += `\n\n> **Context:** "${m.highlightedContext}"`;
                }
                if (m.suggestedSnippet) {
                    block += `\n\n**Suggested Snippet:**\n\`\`\`text\n${m.suggestedSnippet}\n\`\`\``;
                }
                return block;
            }).join('\n\n---\n\n');

            const header = `# KIVI AI Assistant Chat History\n**Date:** ${new Date().toLocaleString()}\n**User:** ${user?.name || user?.email || 'User'}\n\n---\n\n`;
            const blob = new Blob([header + conversationText], { type: 'text/markdown;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kivi-chat-history-${new Date().toISOString().slice(0, 10)}.md`;
            a.click();
            URL.revokeObjectURL(url);

            setSaveToast(true);
            setTimeout(() => setSaveToast(false), 3000);
        } catch (err) {
            console.error('Failed to export chat history:', err);
        }
    };

    useEffect(() => {
        if (isKiviOpen) {
            scrollToBottomIfNear(true);
        }
    }, [isKiviOpen, scrollToBottomIfNear]);

    // Handle drag resizing from top, left, and top-left corner
    const handleResizeStart = (direction, e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isMaximized) return;

        isResizingRef.current = true;
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = drawerSize.width;
        const startHeight = drawerSize.height;

        const onMouseMove = (moveEvent) => {
            if (!isResizingRef.current) return;

            const deltaX = startX - moveEvent.clientX;
            const deltaY = startY - moveEvent.clientY;

            let newWidth = startWidth;
            let newHeight = startHeight;

            if (direction.includes('w')) {
                const maxAllowedWidth = Math.min(window.innerWidth - 64, 960);
                newWidth = Math.min(Math.max(startWidth + deltaX, 340), maxAllowedWidth);
            }

            if (direction.includes('n')) {
                const maxAllowedHeight = Math.min(window.innerHeight - 120, 900);
                newHeight = Math.min(Math.max(startHeight + deltaY, 400), maxAllowedHeight);
            }

            setDrawerSize({ width: newWidth, height: newHeight });
        };

        const onMouseUp = () => {
            isResizingRef.current = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            setDrawerSize((current) => {
                try {
                    localStorage.setItem('kivi_drawer_size', JSON.stringify(current));
                } catch (e) {}
                return current;
            });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Proactive Idle Nudge effect (triggers nudge after 6s of inactivity)
    useEffect(() => {
        const resetIdleTimer = () => {
            setShowIdleNudge(false);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(() => {
                setShowIdleNudge(true);
            }, 6000);
        };

        resetIdleTimer();

        window.addEventListener('mousemove', resetIdleTimer);
        window.addEventListener('keydown', resetIdleTimer);
        window.addEventListener('click', resetIdleTimer);

        return () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            window.removeEventListener('mousemove', resetIdleTimer);
            window.removeEventListener('keydown', resetIdleTimer);
            window.removeEventListener('click', resetIdleTimer);
        };
    }, []);

    // Selection Tracking across main document and TipTap editor
    useEffect(() => {
        const handleSelectionChange = (e) => {
            const activeEl = document.activeElement;
            if (activeEl && typeof activeEl.closest === 'function' && 
                (activeEl.closest('.ai-chat-copilot-floating-drawer') || activeEl.closest('.kivi-floating-trigger'))) {
                return;
            }

            const targetEl = e?.target && e.target.nodeType === 1 ? e.target : (e?.target?.parentElement || null);
            if (targetEl && typeof targetEl.closest === 'function' && 
                (targetEl.closest('.ai-chat-copilot-floating-drawer') || targetEl.closest('.kivi-floating-trigger'))) {
                return;
            }

            const sel = window.getSelection();
            const text = sel ? sel.toString().trim() : '';

            const editorEl = document.querySelector('.tiptap-prose[contenteditable="true"]') || 
                             document.querySelector('.ProseMirror[contenteditable="true"]') ||
                             document.querySelector('.resume-editor-pane [contenteditable="true"]') ||
                             document.querySelector('.cover-letter-editor [contenteditable="true"]');
            const isInsideEditor = Boolean(editorEl && sel && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode));

            if (isInsideEditor && text && text.length > 2) {
                savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                setSelectedSnippet(text);
            } else if (isInsideEditor && (!text || text.length === 0)) {
                setSelectedSnippet('');
                savedRangeRef.current = null;
            }
        };

        document.addEventListener('mouseup', handleSelectionChange);
        document.addEventListener('keyup', handleSelectionChange);
        document.addEventListener('selectionchange', handleSelectionChange);

        return () => {
            document.removeEventListener('mouseup', handleSelectionChange);
            document.removeEventListener('keyup', handleSelectionChange);
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, []);

    // Clean up ongoing SSE streaming on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (streamTimerRef.current) {
                cancelAnimationFrame(streamTimerRef.current);
                streamTimerRef.current = null;
            }
        };
    }, []);

    /**
     * High-Performance Word-to-Word Smoothing Engine (60 FPS fluid rendering)
     * Drains the incoming token buffer smoothly without freezing the UI or skipping frames.
     */
    const startSmoothStreamDrain = useCallback((aiMsgId) => {
        let lastFrameTime = performance.now();

        const tick = () => {
            const now = performance.now();
            const elapsed = now - lastFrameTime;

            // Target smooth ~24ms cadence per step (adaptive for natural reading speed)
            if (elapsed >= 22) {
                lastFrameTime = now;
                const queue = streamQueueRef.current;

                if (queue.length > 0) {
                    // Dynamically scale chunk slice based on queue backlog to eliminate network jitter
                    let sliceLength = 1;
                    if (queue.length > 120) {
                        sliceLength = Math.min(28, queue.length);
                    } else if (queue.length > 60) {
                        sliceLength = Math.min(14, queue.length);
                    } else if (queue.length > 20) {
                        // Word boundary search
                        const nextSpace = queue.indexOf(' ', 3);
                        sliceLength = nextSpace > 0 ? nextSpace + 1 : Math.min(6, queue.length);
                    } else {
                        const nextSpace = queue.indexOf(' ');
                        sliceLength = nextSpace > 0 ? nextSpace + 1 : Math.min(3, queue.length);
                    }

                    const nextPiece = queue.slice(0, sliceLength);
                    streamQueueRef.current = queue.slice(sliceLength);
                    displayedTextRef.current += nextPiece;

                    const updatedText = displayedTextRef.current;
                    setChatMessages(prev => prev.map(msg => {
                        if (msg.id === aiMsgId) {
                            return { ...msg, text: updatedText, isStreaming: true };
                        }
                        return msg;
                    }));

                    scrollToBottomIfNear();
                } else if (isStreamingDoneRef.current) {
                    // All tokens in queue have finished draining smoothly!
                    const doneData = pendingDoneDataRef.current;
                    setChatMessages(prev => prev.map(msg => {
                        if (msg.id === aiMsgId) {
                            return {
                                ...msg,
                                text: doneData?.replyText || doneData?.reply || displayedTextRef.current || msg.text || 'I could not find specific details for that query.',
                                targetText: doneData?.targetText || msg.targetText || null,
                                suggestedSnippet: doneData?.suggestedSnippet || null,
                                resources: doneData?.resources || [],
                                searchStatus: null,
                                isStreaming: false
                            };
                        }
                        return msg;
                    }));

                    setChatLoading(false);
                    if (streamTimerRef.current) {
                        cancelAnimationFrame(streamTimerRef.current);
                        streamTimerRef.current = null;
                    }
                    scrollToBottomIfNear(true);
                    return;
                }
            }

            streamTimerRef.current = requestAnimationFrame(tick);
        };

        if (streamTimerRef.current) {
            cancelAnimationFrame(streamTimerRef.current);
        }
        streamTimerRef.current = requestAnimationFrame(tick);
    }, [scrollToBottomIfNear]);

    const handleSendChatMessage = async (e, customText = null, actionPreset = null) => {
        if (e) e.preventDefault();
        const messageToSend = customText || chatInput;
        if (!messageToSend.trim() && !selectedSnippet && !actionPreset) return;

        // Cancel any existing in-flight stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        if (streamTimerRef.current) {
            cancelAnimationFrame(streamTimerRef.current);
            streamTimerRef.current = null;
        }
        abortControllerRef.current = new AbortController();

        const userMsgText = messageToSend.trim() || (actionPreset ? `Apply preset: ${actionPreset}` : 'Refine selection');
        const activeSnippet = selectedSnippet;

        setSelectedSnippet('');
        
        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: userMsgText,
            highlightedContext: (actionPreset || activeSnippet) ? activeSnippet : null
        };

        const aiMsgId = Date.now() + 1;
        const initialAiMsg = {
            id: aiMsgId,
            sender: 'ai',
            text: '',
            isStreaming: true,
            suggestedSnippet: null,
            targetText: activeSnippet || null,
            resources: []
        };

        // Reset streaming buffer refs
        streamQueueRef.current = '';
        displayedTextRef.current = '';
        isStreamingDoneRef.current = false;
        activeStreamAiMsgIdRef.current = aiMsgId;
        pendingDoneDataRef.current = null;

        setChatMessages(prev => [...prev, userMsg, initialAiMsg]);
        if (!customText) setChatInput('');
        setChatLoading(true);

        const urlMatch = window.location.pathname.match(/\/(?:interview|resume|cover-letter)\/([a-f0-9]{24})/i);
        const currentReportId = urlMatch ? urlMatch[1] : null;

        // Start smooth rendering loop
        startSmoothStreamDrain(aiMsgId);

        // Capture live HTML from the TipTap viewport so real-time modifications are preserved
        const currentResumeHtml = typeof window.__KIVI_GET_CURRENT_RESUME_HTML__ === 'function' 
            ? window.__KIVI_GET_CURRENT_RESUME_HTML__() 
            : '';

        try {
            await streamAssistantChatApi({
                reportId: currentReportId,
                message: messageToSend,
                selectedText: activeSnippet || '',
                action: actionPreset || '',
                instruction: messageToSend,
                currentResumeHtml,
                signal: abortControllerRef.current.signal,
                onStatus: (statusData) => {
                    setChatMessages(prev => prev.map(msg => {
                        if (msg.id === aiMsgId) {
                            return { ...msg, searchStatus: statusData };
                        }
                        return msg;
                    }));
                },
                onToken: (token) => {
                    // Push incoming token into smooth queue
                    streamQueueRef.current += token;
                },
                onDone: (data) => {
                    pendingDoneDataRef.current = data;
                    isStreamingDoneRef.current = true;
                    if (fetchUsage) fetchUsage();

                    // Step 4: Visual Diff Preview & Tracking on TipTap Viewport (Strikethrough Old + Green New)
                    if (data?.ResumeUpdations && data.ResumeUpdations !== false && typeof data.ResumeUpdations === 'string') {
                        const currentLiveHtml = typeof window.__KIVI_GET_CURRENT_RESUME_HTML__ === 'function'
                            ? window.__KIVI_GET_CURRENT_RESUME_HTML__()
                            : (currentResumeHtml || '');

                        const diffRes = TrackUpdatePart(currentLiveHtml, data.ResumeUpdations, data.targetText);

                        if (diffRes) {
                            window.dispatchEvent(new CustomEvent('kivi-show-diff', {
                                detail: {
                                    diffData: {
                                        diffPreviewHtml: diffRes.diffPreviewHtml,
                                        mergedFullResumeHtml: diffRes.mergedFullResumeHtml,
                                        oldFullResumeHtml: diffRes.oldFullResumeHtml || currentLiveHtml,
                                        targetText: diffRes.targetText || data.targetText || '',
                                        replacementHtml: diffRes.replacementHtml || data.ResumeUpdations || '',
                                        sectionName: diffRes.sectionName || null,
                                        msgId: aiMsgId
                                    },
                                    updatedPart: diffRes,
                                    msgId: aiMsgId,
                                    newFullHtml: diffRes?.mergedFullResumeHtml || data.ResumeUpdations,
                                    targetText: diffRes?.targetText || data.targetText || '',
                                    messageForUser: data.messageForUser || data.reply || ''
                                }
                            }));
                        }
                    }
                },
                onError: (err) => {
                    if (err.name === 'AbortError') return;
                    console.error("KIVI Chat Streaming error:", err);
                    if (streamTimerRef.current) {
                        cancelAnimationFrame(streamTimerRef.current);
                        streamTimerRef.current = null;
                    }
                    setChatMessages(prev => prev.map(msg => {
                        if (msg.id === aiMsgId) {
                            return {
                                ...msg,
                                text: msg.text ? (msg.text + '\n\n⚠️ Stream interrupted.') : (err?.message || '⚠️ Sorry, I encountered an issue. Please try again.'),
                                isStreaming: false
                            };
                        }
                        return msg;
                    }));
                    setChatLoading(false);
                }
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("KIVI Chat error:", err);
                if (streamTimerRef.current) {
                    cancelAnimationFrame(streamTimerRef.current);
                    streamTimerRef.current = null;
                }
                setChatMessages(prev => prev.map(msg => {
                    if (msg.id === aiMsgId) {
                        return {
                            ...msg,
                            text: err?.message || '⚠️ Sorry, I encountered an issue. Please try sending your message again.',
                            isStreaming: false
                        };
                    }
                    return msg;
                }));
                setChatLoading(false);
            }
        }
    };

    // Apply suggested snippet directly to TipTap editor or active document
    const handleApplySuggestedSnippet = useCallback((msgId, snippet, targetText = null) => {
        if (!snippet) return;
        const cleanSnippet = parseAndSanitizeSnippet(snippet);
        if (!cleanSnippet) return;
        if (fetchUsage) fetchUsage();

        if (msgId) {
            setAppliedMsgIds(prev => new Set(prev).add(msgId));
        }

        // Trigger TipTap live diff accept if active
        window.dispatchEvent(new CustomEvent('kivi-accept-diff', {
            detail: { msgId, snippet: cleanSnippet, targetText }
        }));

        const evt = new CustomEvent('kivi-replace-text', {
            detail: { targetText, snippet: cleanSnippet },
            cancelable: true
        });
        window.dispatchEvent(evt);

        if (evt.defaultPrevented) {
            return;
        }

        const editorEl = document.querySelector('.tiptap-prose[contenteditable="true"]') || document.querySelector('[contenteditable="true"]');

        if (editorEl) {
            editorEl.focus();

            if (targetText && targetText.trim()) {
                const cleanTarget = targetText.trim();
                const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while ((node = walker.nextNode())) {
                    if (node.nodeValue && node.nodeValue.includes(cleanTarget)) {
                        node.nodeValue = node.nodeValue.replace(cleanTarget, cleanSnippet);
                        editorEl.dispatchEvent(new Event('input', { bubbles: true }));
                        return;
                    }
                }
            }

            if (savedRangeRef.current) {
                try {
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(savedRangeRef.current);
                    
                    const range = sel.getRangeAt(0);
                    range.deleteContents();
                    const textNode = document.createTextNode(snippet);
                    range.insertNode(textNode);
                    
                    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                } catch (err) {
                    console.warn("Could not restore saved selection range:", err);
                }
            }

            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (editorEl.contains(range.commonAncestorContainer)) {
                    range.deleteContents();
                    const textNode = document.createTextNode(snippet);
                    range.insertNode(textNode);
                    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
                    return;
                }
            }

            document.execCommand('insertText', false, snippet);
            editorEl.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        const iframe = document.querySelector('iframe.resume-frame') || document.querySelector('iframe');
        if (iframe) {
            const win = iframe.contentWindow;
            const doc = iframe.contentDocument || win?.document;
            if (win && typeof win.focus === 'function') {
                win.focus();
            }
            if (win && doc) {
                const sel = win.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(doc.createTextNode(snippet));
                    if (doc.body) {
                        doc.body.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    return;
                }
            }
            if (doc && typeof doc.execCommand === 'function') {
                doc.execCommand('insertText', false, snippet);
                if (doc.body) {
                    doc.body.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
    }, [fetchUsage]);

    const isAiBlocked = Boolean(user?.blockedFeatures?.aiAssistant);

    const drawerInlineStyle = {
        width: isMaximized ? 'min(860px, calc(100vw - 64px))' : `${drawerSize.width}px`,
        height: isMaximized ? 'min(850px, calc(100vh - 120px))' : `${drawerSize.height}px`
    };

    return (
        <>
            {/* Floating Trigger Button */}
            <div className="kivi-floating-trigger-container">
                {showIdleNudge && !isKiviOpen && (
                    <div className="kivi-idle-nudge-bubble" onClick={() => { setIsKiviOpen(true); setShowIdleNudge(false); }}>
                        <span className="nudge-text">💡 Need help refining your resume? Click KIVI!</span>
                        <button type="button" className="nudge-close-btn" onClick={(e) => { e.stopPropagation(); setShowIdleNudge(false); }} title="Dismiss">✕</button>
                    </div>
                )}
                <button
                    type="button"
                    className={`kivi-floating-trigger ${isKiviOpen ? 'active' : ''}`}
                    onClick={() => {
                        setIsKiviOpen(!isKiviOpen);
                        setShowIdleNudge(false);
                    }}
                    title={isAiBlocked ? "KIVI AI (Disabled by Admin)" : "KIVI AI Assistant"}
                >
                    {isKiviOpen ? (
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>✕</span>
                    ) : (
                        <img src="/Logo.png" alt="KIVI AI" className="kivi-trigger-logo" />
                    )}
                </button>
            </div>

            {/* Floating AI Chat Drawer */}
            {isKiviOpen && (
                <div 
                    className={`ai-chat-copilot-floating-drawer ${isMaximized ? 'maximized' : ''}`}
                    style={drawerInlineStyle}
                >
                    {/* Top & Left Drag-to-Resize Handles */}
                    {!isMaximized && (
                        <>
                            <div 
                                className="kivi-resize-corner-nw"
                                onMouseDown={(e) => handleResizeStart('nw', e)}
                                title="Drag corner to resize width & height"
                            >
                                <span className="resize-grip-dots">⠿</span>
                            </div>
                            <div 
                                className="kivi-resize-edge-top"
                                onMouseDown={(e) => handleResizeStart('n', e)}
                                title="Drag top edge to resize height"
                            />
                            <div 
                                className="kivi-resize-edge-left"
                                onMouseDown={(e) => handleResizeStart('w', e)}
                                title="Drag left edge to resize width"
                            />
                        </>
                    )}

                    <div className="drawer-header">
                        <div className="header-branding">
                            <img src="/Logo.png" alt="KIVI Logo" className="header-logo" />
                            <div className="header-titles">
                                <h3>KIVI Assistant</h3>
                                <span className="header-status">
                                    {isAiBlocked ? (
                                        <span style={{ color: '#f87171', fontWeight: 800 }}>❌ Disabled by Admin</span>
                                    ) : (
                                        <>● Online · Real-Time Streaming</>
                                    )}
                                </span>
                            </div>
                        </div>
                        <div className="header-actions">
                            <button
                                type="button"
                                className="drawer-header-btn"
                                onClick={handleExportChatHistory}
                                title="Save & Download Chat History (.md)"
                            >
                                💾
                            </button>
                            <button
                                type="button"
                                className="drawer-header-btn"
                                onClick={handleClearChatHistory}
                                title="Clear Chat History & Start Fresh"
                            >
                                🔄
                            </button>
                            <button
                                type="button"
                                className="drawer-header-btn"
                                onClick={() => setIsMaximized(!isMaximized)}
                                title={isMaximized ? "Restore default window size" : "Maximize / Expand window"}
                            >
                                {isMaximized ? '🗗' : '🗖'}
                            </button>
                            <button 
                                type="button" 
                                className="drawer-close-btn" 
                                onClick={() => {
                                    if (abortControllerRef.current) {
                                        abortControllerRef.current.abort();
                                    }
                                    if (streamTimerRef.current) {
                                        cancelAnimationFrame(streamTimerRef.current);
                                        streamTimerRef.current = null;
                                    }
                                    setIsKiviOpen(false);
                                }}
                                title="Close KIVI"
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {saveToast && (
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            borderBottom: '1px solid rgba(16, 185, 129, 0.35)',
                            color: '#34d399',
                            padding: '0.45rem 0.8rem',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            textAlign: 'center'
                        }}>
                            💾 Chat saved to history & downloaded as Markdown!
                        </div>
                    )}

                    {isAiBlocked && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#f87171',
                            padding: '0.6rem 0.9rem',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            textAlign: 'center'
                        }}>
                            ❌ AI Assistant access has been disabled for your account by an administrator.
                        </div>
                    )}

                    {selectedSnippet && (
                        <div className="live-context-banner">
                            <span className="context-icon">📌</span>
                            <div className="context-text">
                                <span className="context-label">Active Context:</span>
                                <span className="context-snippet">"{selectedSnippet.slice(0, 50)}{selectedSnippet.length > 50 ? '...' : ''}"</span>
                            </div>
                            <button type="button" className="context-clear-btn" onClick={() => setSelectedSnippet('')} title="Clear Context">✕</button>
                        </div>
                    )}

                    {/* Scrollable Messages Stream */}
                    <div className="chat-messages-container" ref={messagesContainerRef}>
                        {chatMessages.map((msg) => (
                            <ChatMessageBubble
                                key={msg.id}
                                msg={msg}
                            />
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Fast AI Action Presets */}
                    <div className="suggestion-pills-bar drawer-quick-actions">
                        <button
                            type="button"
                            className="suggestion-pill quick-action-chip"
                            onClick={(e) => handleSendChatMessage(e, 'Make this bullet point ATS-friendly and impactful', 'make_ats')}
                            disabled={chatLoading || isAiBlocked}
                            title="Format bullet points with strong action verbs & impact"
                        >
                            🎯 Make ATS-Friendly
                        </button>
                        <button
                            type="button"
                            className="suggestion-pill quick-action-chip"
                            onClick={(e) => handleSendChatMessage(e, 'Quantify with metrics, percentages and engineering scale', 'enhance')}
                            disabled={chatLoading || isAiBlocked}
                            title="Add numbers, scale & measurable outcomes"
                        >
                            📈 Add Metrics & Scale
                        </button>
                        <button
                            type="button"
                            className="suggestion-pill quick-action-chip"
                            onClick={(e) => handleSendChatMessage(e, 'Shorten to a crisp, high-impact single line', 'shorten')}
                            disabled={chatLoading || isAiBlocked}
                            title="Make concise without losing key achievements"
                        >
                            ✂️ Shorten
                        </button>
                        <button
                            type="button"
                            className="suggestion-pill quick-action-chip"
                            onClick={(e) => handleSendChatMessage(e, 'Fix grammar, active voice, and professional phrasing', 'fix_grammar')}
                            disabled={chatLoading || isAiBlocked}
                            title="Grammar & executive tone polish"
                        >
                            ✨ Polish Voice
                        </button>
                    </div>

                    {/* Interactive Input Form */}
                    <form className="chat-input-form drawer-input-form" onSubmit={(e) => handleSendChatMessage(e)}>
                        <input
                            type="text"
                            className="chat-input-field drawer-text-input"
                            placeholder={selectedSnippet 
                                ? `Instruct KIVI on highlighted text...` 
                                : "Ask KIVI anything or request edits..."
                            }
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            disabled={chatLoading || isAiBlocked}
                            autoFocus
                        />
                        <button 
                            type="submit" 
                            className="chat-send-btn drawer-send-btn"
                            disabled={(!chatInput.trim() && !selectedSnippet) || chatLoading || isAiBlocked}
                            title="Send prompt"
                        >
                            {chatLoading ? (
                                <span className="send-spinner"></span>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            )}
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
