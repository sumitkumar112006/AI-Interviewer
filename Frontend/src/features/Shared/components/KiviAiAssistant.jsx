import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../Auth/hooks/useAuth';
import { rewriteResumeSection } from '../../Interview/services/interview.api';
import './KiviAiAssistant.scss';

export function KiviAiAssistant() {
    const { user, fetchUsage } = useAuth();
    const [isKiviOpen, setIsKiviOpen] = useState(false);
    const [showIdleNudge, setShowIdleNudge] = useState(false);
    const idleTimerRef = useRef(null);
    const savedRangeRef = useRef(null);

    if (!user) {
        return null;
    }

    const [selectedSnippet, setSelectedSnippet] = useState('');
    const [chatMessages, setChatMessages] = useState([
        {
            id: 1,
            sender: 'ai',
            text: '👋 Hi! I am KIVI, your AI Assistant. Highlight any text in your Resume or Cover Letter editor, then send me instructions or click quick presets to improve it!'
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
                // Check if selection is inside a TipTap editor or document
                const editorEl = document.querySelector('.tiptap-prose[contenteditable="true"]') || document.querySelector('[contenteditable="true"]');
                if (editorEl && sel.rangeCount > 0 && editorEl.contains(sel.anchorNode)) {
                    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                }
                setSelectedSnippet(text);
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

    const handleSendChatMessage = async (e, customText = null, actionPreset = null) => {
        if (e) e.preventDefault();
        const messageToSend = customText || chatInput;
        if (!messageToSend.trim() && !selectedSnippet && !actionPreset) return;

        const userMsgText = messageToSend.trim() || (actionPreset ? `Apply preset: ${actionPreset}` : 'Refine selection');
        
        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: userMsgText,
            highlightedContext: selectedSnippet ? selectedSnippet : null
        };

        setChatMessages(prev => [...prev, userMsg]);
        if (!customText) setChatInput('');
        setChatLoading(true);

        try {
            const res = await rewriteResumeSection({
                selectedText: selectedSnippet,
                instruction: messageToSend,
                action: actionPreset || 'enhance',
                message: messageToSend
            });

            if (fetchUsage) fetchUsage();

            const aiMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: res?.replyText || 'Here is information to assist you.',
                suggestedSnippet: res?.suggestedSnippet || null
            };
            setChatMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            console.error("KIVI Chat error:", err);
            const errorMsg = {
                id: Date.now() + 1,
                sender: 'ai',
                text: err?.response?.data?.message || '⚠️ Sorry, I encountered an issue. Please try sending your message again.'
            };
            setChatMessages(prev => [...prev, errorMsg]);
        } finally {
            setChatLoading(false);
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
                <div className="ai-chat-copilot-floating-drawer">
                    <div className="drawer-header">
                        <div className="header-branding">
                            <img src="/Logo.png" alt="KIVI Logo" className="header-logo" />
                            <div className="header-titles">
                                <h3>KIVI Assistant</h3>
                                <span className="header-status">
                                    {isAiBlocked ? (
                                        <span style={{ color: '#f87171', fontWeight: 800 }}>❌ Disabled by Admin</span>
                                    ) : (
                                        <>● Online · Powered by Gemini Pro</>
                                    )}
                                </span>
                            </div>
                        </div>
                        <button 
                            type="button" 
                            className="drawer-close-btn" 
                            onClick={() => setIsKiviOpen(false)}
                            title="Close KIVI"
                        >
                            ✕
                        </button>
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
                                <span className="context-snippet">"{selectedSnippet.slice(0, 45)}{selectedSnippet.length > 45 ? '...' : ''}"</span>
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
                                    <p className="msg-text">{msg.text}</p>

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
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="chat-bubble-row ai">
                                <img src="/Logo.png" alt="KIVI" className="chat-avatar-img" />
                                <div className="chat-bubble ai typing">
                                    <span className="dot"></span>
                                    <span className="dot"></span>
                                    <span className="dot"></span>
                                </div>
                            </div>
                        )}
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
