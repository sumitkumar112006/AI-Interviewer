import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAuth } from '../../Auth/hooks/useAuth';
import { streamAssistantChatApi, rewriteResumeSection } from '../../Interview/services/interview.api';
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

export function KiviAiAssistant() {
    const { user, fetchUsage } = useAuth();
    const [isKiviOpen, setIsKiviOpen] = useState(false);
    const [showIdleNudge, setShowIdleNudge] = useState(false);
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
    const [chatMessages, setChatMessages] = useState([
        {
            id: 1,
            sender: 'ai',
            text: '👋 Hi! I am KIVI, your AI Assistant. Highlight any text in your Resume or Cover Letter editor, then send me instructions or click quick presets to improve it!',
            isStreaming: false
        }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
            // Ignore mouse clicks/events originating from inside the KIVI AI drawer itself
            const targetEl = e?.target && e.target.nodeType === 1 ? e.target : (e?.target?.parentElement || null);
            if (targetEl && typeof targetEl.closest === 'function' && 
                (targetEl.closest('.ai-chat-copilot-floating-drawer') || targetEl.closest('.kivi-floating-trigger'))) {
                return;
            }

            const sel = window.getSelection();
            const text = sel ? sel.toString().trim() : '';

            if (text && text.length > 2) {
                // Check if selection is strictly inside an active TipTap editor or document contenteditable container
                const editorEl = document.querySelector('.tiptap-prose[contenteditable="true"]') || 
                                 document.querySelector('.ProseMirror[contenteditable="true"]') ||
                                 document.querySelector('.resume-editor-pane [contenteditable="true"]') ||
                                 document.querySelector('.cover-letter-editor [contenteditable="true"]');
                const isInsideEditor = Boolean(editorEl && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode));

                if (isInsideEditor) {
                    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                    setSelectedSnippet(text);
                } else {
                    // Strict containment: Never capture selections from roadmap, reports, chat, or external UI
                    setSelectedSnippet('');
                    savedRangeRef.current = null;
                }
            } else {
                // Realtime clear when text is unselected
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

        // Clear active selection state immediately after capturing so subsequent queries don't reuse it
        setSelectedSnippet('');
        savedRangeRef.current = null;
        
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
                                text: data.replyText || msg.text || 'Here is information to assist you.',
                                suggestedSnippet: data.suggestedSnippet || null,
                                resources: data.resources || [],
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
    const handleApplySuggestedSnippet = (snippet) => {
        if (!snippet) return;
        if (fetchUsage) fetchUsage();

        // 1. TipTap Prose Editor (Resume & Cover Letter)
        const editorEl = document.querySelector('.tiptap-prose[contenteditable="true"]') || document.querySelector('[contenteditable="true"]');

        if (editorEl) {
            editorEl.focus();

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
                    return;
                }
            }

            // Fallback execCommand insertion
            document.execCommand('insertText', false, snippet);
            editorEl.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }

        // 2. Legacy iframe fallback
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
                                            <div className="typing-dots-wrapper" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', padding: '4px 6px' }}>
                                                <span className="dot"></span>
                                                <span className="dot"></span>
                                                <span className="dot"></span>
                                            </div>
                                        ) : (
                                            <div className="msg-content-wrapper">
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

                                    {/* Suggested Snippet Apply Card */}
                                    {msg.suggestedSnippet && typeof msg.suggestedSnippet === 'string' && msg.suggestedSnippet.trim() !== '' && msg.suggestedSnippet !== 'null' && (
                                        <div className="suggested-snippet-card">
                                            <div className="snippet-body">"{msg.suggestedSnippet}"</div>
                                            <button
                                                type="button"
                                                className="apply-snippet-btn"
                                                onClick={() => handleApplySuggestedSnippet(msg.suggestedSnippet)}
                                                disabled={isAiBlocked}
                                            >
                                                {isAiBlocked ? '❌ Disabled by Admin' : '✅ Apply to Document'}
                                            </button>
                                        </div>
                                    )}

                                    {/* Verified Resources Links */}
                                    {Array.isArray(msg.resources) && msg.resources.length > 0 && (
                                        <div className="verified-resources-panel">
                                            <div className="resources-title">
                                                <span>📚</span> Verified Study & Video Resources:
                                            </div>
                                            {msg.resources.map((res, i) => (
                                                <a 
                                                    key={i} 
                                                    href={res.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="resource-link-item"
                                                >
                                                    {res.type === 'video' ? '▶️' : '🔗'} {res.title}
                                                </a>
                                            ))}
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
