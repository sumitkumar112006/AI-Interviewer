import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../Auth/hooks/useAuth';
import { rewriteResumeSection } from '../../Interview/services/interview.api';
import './KiviAiAssistant.scss';

export function KiviAiAssistant() {
    const { user } = useAuth();
    const [isKiviOpen, setIsKiviOpen] = useState(false);
    const [showIdleNudge, setShowIdleNudge] = useState(false);
    const idleTimerRef = useRef(null);

    if (!user) {
        return null;
    }

    const [selectedSnippet, setSelectedSnippet] = useState('');
    const [chatMessages, setChatMessages] = useState([
        {
            id: 1,
            sender: 'ai',
            text: '👋 Hi! I am KIVI, your AI Career Assistant. Highlight any text on your screen, ask me about your resume, or get job & platform help!'
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

    // Global Selection Tracking (Main document & iframe)
    useEffect(() => {
        const handleSelectionChange = () => {
            const sel = window.getSelection();
            const mainText = sel ? sel.toString().trim() : '';
            if (mainText && mainText.length > 2) {
                setSelectedSnippet(mainText);
                return;
            }

            const iframe = document.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                try {
                    const iframeSel = iframe.contentWindow.getSelection();
                    const iframeText = iframeSel ? iframeSel.toString().trim() : '';
                    if (iframeText && iframeText.length > 2) {
                        setSelectedSnippet(iframeText);
                    }
                } catch (e) {
                    // Ignore cross-origin error
                }
            }
        };

        document.addEventListener('mouseup', handleSelectionChange);
        document.addEventListener('keyup', handleSelectionChange);

        return () => {
            document.removeEventListener('mouseup', handleSelectionChange);
            document.removeEventListener('keyup', handleSelectionChange);
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
                text: '⚠️ Sorry, I encountered an issue. Please try sending your message again.'
            };
            setChatMessages(prev => [...prev, errorMsg]);
        } finally {
            setChatLoading(false);
        }
    };

    const handleApplySuggestedSnippet = (snippet) => {
        if (!snippet) return;
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

    return (
        <>
            {/* Proactive Idle Speech Bubble */}
            {showIdleNudge && !isKiviOpen && (
                <div className="kivi-idle-nudge-bubble" onClick={() => { setIsKiviOpen(true); setShowIdleNudge(false); }}>
                    <span className="nudge-close-btn" onClick={(e) => { e.stopPropagation(); setShowIdleNudge(false); }}>✕</span>
                    <div className="nudge-content">
                        <img src="/Logo.png" alt="KIVI Logo" className="nudge-logo-img" />
                        <div>
                            <strong>Hey! I am KIVI</strong>
                            <p>I'm here to help! Click here or highlight text to chat with AI.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Circular KIVI AI Trigger Button */}
            <button 
                type="button" 
                className={`kivi-floating-trigger ${isKiviOpen ? 'active' : ''}`}
                onClick={() => { setIsKiviOpen(!isKiviOpen); setShowIdleNudge(false); }}
                title="KIVI AI Assistant"
            >
                {isKiviOpen ? (
                    <span className="trigger-close-icon">✕</span>
                ) : (
                    <img src="/Logo.png" alt="KIVI Logo" className="kivi-trigger-logo-circular" />
                )}
                <span className="pulse-ring"></span>
            </button>

            {/* Floating KIVI AI Chat Drawer Window */}
            {isKiviOpen && (
                <div className="ai-chat-copilot-floating-drawer panel">
                    <div className="chat-panel-header">
                        <div className="copilot-brand">
                            <img src="/Logo.png" alt="KIVI Logo" className="copilot-avatar-img" />
                            <div>
                                <h3>KIVI AI Assistant</h3>
                                <span className="copilot-status">● Live Assistant</span>
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
                                            >
                                                ✅ Apply to Resume
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
                            disabled={chatLoading}
                        >
                            ✨ Enhance Impact
                        </button>
                        <button 
                            type="button" 
                            className="suggestion-pill"
                            onClick={() => handleSendChatMessage(null, 'Shorten the text to 1 concise bullet point', 'shorten')}
                            disabled={chatLoading}
                        >
                            📝 Shorten
                        </button>
                        <button 
                            type="button" 
                            className="suggestion-pill"
                            onClick={() => handleSendChatMessage(null, 'Fix grammar and spelling', 'fix_grammar')}
                            disabled={chatLoading}
                        >
                            🔧 Fix Grammar
                        </button>
                        <button 
                            type="button" 
                            className="suggestion-pill"
                            onClick={() => handleSendChatMessage(null, 'What is KIVI-AI Platform and how does it work?')}
                            disabled={chatLoading}
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
                            placeholder={selectedSnippet ? "Ask KIVI about selection..." : "Ask KIVI anything..."}
                            disabled={chatLoading}
                        />
                        <button 
                            type="submit" 
                            className="chat-send-btn"
                            disabled={chatLoading || (!chatInput.trim() && !selectedSnippet)}
                        >
                            🚀
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
