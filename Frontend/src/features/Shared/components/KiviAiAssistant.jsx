import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import './KiviAiAssistant.scss';

// Configure marked options
marked.setOptions({
    breaks: true,
    gfm: true
});

const renderMarkdown = (content) => {
    if (!content) return '';
    // Normalize any stray <br> tags
    const normalized = content.replace(/<br\s*\/?>/gi, '\n');
    const rawHtml = marked.parse(normalized);
    return DOMPurify.sanitize(rawHtml);
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
    const [copiedMsgId, setCopiedMsgId] = useState(null);

    const handleCopySnippet = (msgId, snippet) => {
        if (!snippet) return;
        navigator.clipboard.writeText(snippet);
        setCopiedMsgId(msgId);
        setTimeout(() => setCopiedMsgId(null), 2500);
    };

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

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

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

        // Fallback: If logged in and local storage is empty, check backend session cache
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
            scrollToBottom();
        }
    }, [chatMessages, chatLoading, isKiviOpen]);

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

            const deltaX = startX - moveEvent.clientX; // Dragging left increases width
            const deltaY = startY - moveEvent.clientY; // Dragging top increases height

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

            // Save user size preference
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
            // Ignore if active element or event target is inside KIVI drawer or floating trigger
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

            // Check if selection is strictly inside an active TipTap editor or document contenteditable container
            const editorEl = document.querySelector('.tiptap-prose[contenteditable="true"]') || 
                             document.querySelector('.ProseMirror[contenteditable="true"]') ||
                             document.querySelector('.resume-editor-pane [contenteditable="true"]') ||
                             document.querySelector('.cover-letter-editor [contenteditable="true"]');
            const isInsideEditor = Boolean(editorEl && sel && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode));

            if (isInsideEditor && text && text.length > 2) {
                savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                setSelectedSnippet(text);
            } else if (isInsideEditor && (!text || text.length === 0)) {
                // Realtime clear ONLY when user explicitly deselects inside the editor
                setSelectedSnippet('');
                savedRangeRef.current = null;
            }
            // If selection is outside the editor (e.g. clicking anywhere else), keep saved context intact!
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

    // Clean up ongoing SSE streaming on unmount or drawer close
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const handleSendChatMessage = async (e, customText = null, actionPreset = null) => {
        if (e) e.preventDefault();
        const messageToSend = customText || chatInput;
        if (!messageToSend.trim() && !selectedSnippet && !actionPreset) return;

        // Cancel any existing in-flight stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const userMsgText = messageToSend.trim() || (actionPreset ? `Apply preset: ${actionPreset}` : 'Refine selection');
        const activeSnippet = selectedSnippet;

        // Clear active selection state from UI after capturing so subsequent queries don't reuse it
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

        setChatMessages(prev => [...prev, userMsg, initialAiMsg]);
        if (!customText) setChatInput('');
        setChatLoading(true);

        const urlMatch = window.location.pathname.match(/\/(?:interview|resume|cover-letter)\/([a-f0-9]{24})/i);
        const currentReportId = urlMatch ? urlMatch[1] : null;

        try {
            await streamAssistantChatApi({
                reportId: currentReportId,
                message: messageToSend,
                selectedText: activeSnippet || '',
                action: actionPreset || '',
                instruction: messageToSend,
                signal: abortControllerRef.current.signal,
                onStatus: (statusData) => {
                    setChatMessages(prev => prev.map(msg => {
                        if (msg.id === aiMsgId) {
                            return { ...msg, searchStatus: statusData };
                        }
                        return msg;
                    }));
                },
                onToken: (token, accumulated) => {
                    setChatMessages(prev => prev.map(msg => {
                        if (msg.id === aiMsgId) {
                            return { ...msg, text: accumulated, isStreaming: true };
                        }
                        return msg;
                    }));
                },
                onDone: (data) => {
                    setChatMessages(prev => prev.map(msg => {
                        if (msg.id === aiMsgId) {
                            return {
                                ...msg,
                                text: data.replyText || data.reply || msg.text || 'I could not find specific details for that query in your active resume. Please verify your resume content.',
                                targetText: data.targetText || activeSnippet || msg.targetText || null,
                                suggestedSnippet: data.suggestedSnippet || null,
                                resources: data.resources || [],
                                searchStatus: null,
                                isStreaming: false
                            };
                        }
                        return msg;
                    }));
                    setChatLoading(false);
                    if (fetchUsage) fetchUsage();
                },
                onError: (err) => {
                    if (err.name === 'AbortError') return;
                    console.error("KIVI Chat Streaming error:", err);
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
    const handleApplySuggestedSnippet = (msgId, snippet, targetText = null) => {
        if (!snippet) return;
        if (fetchUsage) fetchUsage();

        // 1. Dispatch custom event for Resume.jsx or CoverLetter.jsx to handle in-place replacement via ref!
        const evt = new CustomEvent('kivi-replace-text', {
            detail: { targetText, snippet },
            cancelable: true
        });
        window.dispatchEvent(evt);

        // If handled by Resume or Cover Letter editor, mark applied and skip fallback!
        if (evt.defaultPrevented) {
            if (msgId) {
                setAppliedMsgIds(prev => new Set(prev).add(msgId));
            }
            return;
        }

        // 2. TipTap Prose Editor fallback (only if event was not handled)
        const editorEl = document.querySelector('.tiptap-prose[contenteditable="true"]') || document.querySelector('[contenteditable="true"]');

        if (editorEl) {
            editorEl.focus();

            // If targetText was identified, search and replace in editor innerText
            if (targetText && targetText.trim()) {
                const cleanTarget = targetText.trim();
                const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT, null, false);
                let node;
                while ((node = walker.nextNode())) {
                    if (node.nodeValue && node.nodeValue.includes(cleanTarget)) {
                        node.nodeValue = node.nodeValue.replace(cleanTarget, snippet);
                        editorEl.dispatchEvent(new Event('input', { bubbles: true }));
                        if (msgId) setAppliedMsgIds(prev => new Set(prev).add(msgId));
                        return;
                    }
                }
            }

            // Try restoring saved selection range
            if (savedRangeRef.current) {
                try {
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(savedRangeRef.current);
                    
                    const range = sel.getRangeAt(0);
                    range.deleteContents();
                    const textNode = document.createTextNode(snippet);
                    range.insertNode(textNode);
                    
                    // Dispatch input event for React state updates
                    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
                    if (msgId) setAppliedMsgIds(prev => new Set(prev).add(msgId));
                    return;
                } catch (err) {
                    console.warn("Could not restore saved selection range:", err);
                }
            }

            // Direct selection replacement
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (editorEl.contains(range.commonAncestorContainer)) {
                    range.deleteContents();
                    const textNode = document.createTextNode(snippet);
                    range.insertNode(textNode);
                    editorEl.dispatchEvent(new Event('input', { bubbles: true }));
                    if (msgId) setAppliedMsgIds(prev => new Set(prev).add(msgId));
                    return;
                }
            }

            // Fallback execCommand insertion
            document.execCommand('insertText', false, snippet);
            editorEl.dispatchEvent(new Event('input', { bubbles: true }));
            if (msgId) setAppliedMsgIds(prev => new Set(prev).add(msgId));
            return;
        }

        // 3. Legacy iframe fallback
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
                    if (msgId) setAppliedMsgIds(prev => new Set(prev).add(msgId));
                    return;
                }
            }
            if (doc && typeof doc.execCommand === 'function') {
                doc.execCommand('insertText', false, snippet);
                if (doc.body) {
                    doc.body.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (msgId) setAppliedMsgIds(prev => new Set(prev).add(msgId));
            }
        }
    };

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
                    <div className="chat-messages-container">
                        {chatMessages.map((msg) => (
                            <div key={msg.id} className={`chat-bubble-row ${msg.sender}`}>
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
                                                    <div className="kivi-searching-card mini">
                                                        <div className="searching-header">
                                                            <span className="searching-radar-icon mini">
                                                                <span className="radar-ping"></span>
                                                                <span className="radar-core">🔍</span>
                                                            </span>
                                                            <span className="searching-title">{msg.searchStatus.message || 'Grounded in verified search resources'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div
                                                    className="msg-markdown-content"
                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                                                />
                                                {msg.isStreaming && <span className="streaming-cursor" />}
                                            </div>
                                        )
                                    ) : (
                                        <p className="msg-text">
                                            {msg.text}
                                        </p>
                                    )}

                                    {/* Suggested Snippet Apply Card / In-Place Diff View */}
                                    {msg.suggestedSnippet && typeof msg.suggestedSnippet === 'string' && msg.suggestedSnippet.trim() !== '' && msg.suggestedSnippet !== 'null' && (
                                        <div className="suggested-snippet-card">
                                            {msg.targetText ? (
                                                <div className="snippet-diff-container">
                                                    <div className="snippet-diff-item diff-original">
                                                        <span className="diff-tag original">Original Line</span>
                                                        <p className="diff-text">{msg.targetText}</p>
                                                    </div>
                                                    <div className="snippet-diff-divider">⬇ Improved ATS Version</div>
                                                    <div className="snippet-diff-item diff-replacement">
                                                        <span className="diff-tag updated">Suggested Update</span>
                                                        <p className="diff-text">{msg.suggestedSnippet}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="snippet-body">"{msg.suggestedSnippet}"</div>
                                            )}

                                            <div className="snippet-actions-row">
                                                {isEditorPage ? (
                                                    <button
                                                        type="button"
                                                        className={`apply-snippet-btn ${appliedMsgIds.has(msg.id) ? 'btn-applied' : msg.targetText ? 'btn-replace-target' : 'btn-insert-target'}`}
                                                        onClick={() => handleApplySuggestedSnippet(msg.id, msg.suggestedSnippet, msg.targetText || null)}
                                                        disabled={isAiBlocked || appliedMsgIds.has(msg.id)}
                                                    >
                                                        {isAiBlocked
                                                            ? '❌ Disabled by Admin'
                                                            : appliedMsgIds.has(msg.id)
                                                                ? `✅ Applied to ${docTypeLabel}`
                                                                : msg.targetText
                                                                    ? `⚡ Replace in ${docTypeLabel}`
                                                                    : `➕ Insert into ${docTypeLabel}`
                                                        }
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className={`copy-snippet-btn ${copiedMsgId === msg.id ? 'is-copied' : ''}`}
                                                            onClick={() => handleCopySnippet(msg.id, msg.suggestedSnippet)}
                                                            title="Copy to clipboard"
                                                        >
                                                            {copiedMsgId === msg.id ? '✅ Copied to Clipboard!' : '📋 Copy Snippet'}
                                                        </button>
                                                        {currentReportId && (
                                                            <button
                                                                type="button"
                                                                className="open-editor-link-btn"
                                                                onClick={() => navigate(`/resume/${currentReportId}`)}
                                                                title="Open Resume Studio to edit and apply"
                                                            >
                                                                📄 Open Resume Studio ↗
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Suggestion Pills Bar */}
                    <div className="suggestion-pills-bar">
                        <button 
                            type="button" 
                            className="suggestion-pill"
                            onClick={() => handleSendChatMessage(null, 'Make the text snippet high impact with action verbs', 'enhance')}
                            disabled={chatLoading || isAiBlocked}
                        >
                            ✨ Enhance Impact
                        </button>
                        <button 
                            type="button" 
                            className="suggestion-pill"
                            onClick={() => handleSendChatMessage(null, 'Shorten the text to 1 concise bullet point', 'shorten')}
                            disabled={chatLoading || isAiBlocked}
                        >
                            📝 Shorten
                        </button>
                        <button 
                            type="button" 
                            className="suggestion-pill"
                            onClick={() => handleSendChatMessage(null, 'Fix grammar and spelling', 'fix_grammar')}
                            disabled={chatLoading || isAiBlocked}
                        >
                            🔧 Fix Grammar
                        </button>
                        <button 
                            type="button" 
                            className="suggestion-pill"
                            onClick={() => handleSendChatMessage(null, 'What is KIVI-AI Platform and how does it work?')}
                            disabled={chatLoading || isAiBlocked}
                        >
                            💡 About Platform
                        </button>
                    </div>

                    {/* Chat Input Form */}
                    <form onSubmit={(e) => handleSendChatMessage(e)} className="chat-input-form">
                        <input
                            type="text"
                            className="chat-input-field"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={isAiBlocked ? "❌ AI Assistant Disabled by Admin" : (selectedSnippet ? "Ask KIVI about selection..." : "Ask KIVI anything...")}
                            disabled={chatLoading || isAiBlocked}
                        />
                        <button 
                            type="submit" 
                            className="chat-send-btn"
                            disabled={chatLoading || isAiBlocked || (!chatInput.trim() && !selectedSnippet)}
                        >
                            🚀
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
