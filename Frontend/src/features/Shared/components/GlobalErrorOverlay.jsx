import React, { useState, useEffect } from 'react';
import { ErrorModal } from '../../../components/ErrorModal';

// A global error boundary component to catch React rendering crashes
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught a React render crash:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: '#090d16',
                    color: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
                    zIndex: 999999,
                    padding: '2rem',
                    boxSizing: 'border-box',
                    textAlign: 'center'
                }}>
                    <div style={{
                        maxWidth: '550px',
                        width: '100%',
                        background: '#0f1322',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '1.25rem',
                        padding: '2.5rem',
                        boxShadow: '0 0 50px rgba(239, 68, 68, 0.25), 0 20px 50px rgba(0, 0, 0, 0.65)',
                        boxSizing: 'border-box'
                    }}>
                        <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1.25rem' }}>⚠️</span>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 1rem 0', color: '#f87171', letterSpacing: '-0.02em' }}>
                            Application Crash Detected
                        </h2>
                        <p style={{ fontSize: '0.95rem', color: '#9ca3af', lineHeight: '1.6', margin: '0 0 2rem 0' }}>
                            A critical error occurred while rendering the page. Don't worry, your session data is safe.
                        </p>

                        <div style={{ textAlign: 'left', background: 'rgba(0, 0, 0, 0.3)', padding: '1.2rem', borderRadius: '0.75rem', marginBottom: '2rem', border: '1px solid rgba(255, 255, 255, 0.05)', overflow: 'auto', maxHeight: '180px' }}>
                            <p style={{ margin: '0 0 0.75rem 0', fontWeight: 'bold', fontSize: '0.85rem', color: '#ef4444', fontFamily: 'monospace' }}>
                                Error: {this.state.error?.message || String(this.state.error)}
                            </p>
                            {this.state.errorInfo?.componentStack && (
                                <pre style={{ margin: 0, fontSize: '0.7rem', fontFamily: 'monospace', color: '#9ca3af', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.6rem',
                                    border: 'none',
                                    background: 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)',
                                    color: '#ffffff',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                                    transition: 'transform 0.1s'
                                }}
                            >
                                🔄 Reload Application
                            </button>
                            <button
                                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.6rem',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: '#9ca3af',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Global Error Popup Modal Component for unhandled events
export const GlobalErrorOverlay = () => {
    const [error, setError] = useState(null);

    const checkIsLlmBusy = (msg = '', status = 0) => {
        return status === 503 ||
            msg.includes('503') ||
            msg.includes('high demand') ||
            msg.includes('AI service') ||
            msg.includes('UNAVAILABLE') ||
            msg.includes('RESOURCE_EXHAUSTED');
    };

    useEffect(() => {
        // Expose trigger function globally
        window.triggerGlobalError = (message, details = '', isLlmBusy = false, modalTitle = null) => {
            let cleanMsg = message;
            if (typeof cleanMsg === 'string' && (cleanMsg.trim().startsWith('[') || cleanMsg.trim().startsWith('{') || cleanMsg.includes('too_small') || cleanMsg.includes('validation failed'))) {
                cleanMsg = "The AI response was not structured properly. Please click 'Generate' again.";
            }
            const llmBusy = isLlmBusy || checkIsLlmBusy(cleanMsg);
            const title = modalTitle || (llmBusy ? "AI Service Busy" : "Generation Failed");
            setError({ message: cleanMsg, details, isLlmBusy: true, title });
        };

        // Listen for uncaught JavaScript exceptions
        const handleGlobalError = (event) => {
            if (event.message && (
                event.message.includes('ResizeObserver') || 
                event.message.includes('Script error.')
            )) {
                return;
            }

            let msg = event.message || "An unexpected runtime error occurred";
            if (typeof msg === 'string' && (msg.trim().startsWith('[') || msg.trim().startsWith('{'))) {
                msg = "The AI response was not structured properly. Please click 'Generate' again.";
            }
            setError({
                message: msg,
                details: event.error?.stack || `${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`,
                isLlmBusy: true,
                title: checkIsLlmBusy(msg) ? "AI Service Busy" : "Generation Failed"
            });
        };

        // Listen for unhandled Promise rejections (e.g. failed Axios requests without catch block)
        const handlePromiseRejection = (event) => {
            const reason = event.reason;
            let message = "Asynchronous request failed";
            let details = "";
            let status = reason?.response?.status || 0;

            if (reason) {
                message = reason.response?.data?.message || reason.message || message;
                details = reason.stack || String(reason);
            }

            if (typeof message === 'string' && (message.trim().startsWith('[') || message.trim().startsWith('{') || message.includes('too_small') || message.includes('validation failed'))) {
                message = "The AI response was not structured properly. Please click 'Generate' again.";
            }

            const isBusy = checkIsLlmBusy(message, status);
            setError({
                message,
                details,
                isLlmBusy: true,
                title: isBusy ? "AI Service Busy" : "Generation Failed"
            });
        };

        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handlePromiseRejection);

        return () => {
            window.removeEventListener('error', handleGlobalError);
            window.removeEventListener('unhandledrejection', handlePromiseRejection);
            if (window.triggerGlobalError) {
                delete window.triggerGlobalError;
            }
        };
    }, []);

    if (!error) return null;

    if (error.isLlmBusy) {
        return (
            <ErrorModal
                isOpen={true}
                title={error.title || "AI Service Busy"}
                message={error.message}
                onClose={() => setError(null)}
            />
        );
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(5, 8, 15, 0.82)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
            zIndex: 999998,
            padding: '1.5rem',
            boxSizing: 'border-box'
        }}>
            <div style={{
                maxWidth: '500px',
                width: '100%',
                background: '#0f1322',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '1.25rem',
                padding: '2rem',
                boxShadow: '0 0 45px rgba(239, 68, 68, 0.18), 0 25px 60px rgba(0, 0, 0, 0.7)',
                boxSizing: 'border-box',
                position: 'relative'
            }}>
                {/* Dismiss Button */}
                <button
                    onClick={() => setError(null)}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        padding: '0.25rem'
                    }}
                    title="Close"
                >
                    ✕
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ef4444',
                        fontSize: '1.5rem',
                        flexShrink: 0
                    }}>
                        ⚠️
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: '#f87171', letterSpacing: '-0.01em' }}>
                            System Error Encountered
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0.2rem 0 0 0' }}>
                            A critical operation failed or crashed in the background.
                        </p>
                    </div>
                </div>

                <div style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
                    marginBottom: '1.5rem'
                }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#ffffff', fontWeight: '600', lineHeight: '1.5' }}>
                        {error.message}
                    </p>
                    {error.details && (
                        <details style={{ marginTop: '0.75rem' }}>
                            <summary style={{ fontSize: '0.75rem', color: '#6366f1', cursor: 'pointer', outline: 'none', userSelect: 'none', fontWeight: '600' }}>
                                View Diagnostic Log
                            </summary>
                            <pre style={{
                                marginTop: '0.5rem',
                                margin: 0,
                                background: 'rgba(0, 0, 0, 0.4)',
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.7rem',
                                fontFamily: 'monospace',
                                color: '#9ca3af',
                                overflowX: 'auto',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                maxHeight: '120px',
                                lineHeight: '1.3'
                            }}>
                                {error.details}
                            </pre>
                        </details>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={() => setError(null)}
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '0.5rem',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            background: 'transparent',
                            color: '#9ca3af',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            background: '#ef4444',
                            color: '#ffffff',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                        }}
                    >
                        🔄 Reload Page
                    </button>
                </div>
            </div>
        </div>
    );
};
