import React from 'react';

export const ErrorModal = ({ isOpen, title = "AI Service Busy", message, onClose }) => {
    if (!isOpen) return null;

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⏳</div>
                <h3 style={{ margin: '0 0 10px 0', color: '#ffffff', fontSize: '1.25rem' }}>{title}</h3>
                <p style={{ color: '#cbd5e1', marginBottom: '24px', lineHeight: '1.5', fontSize: '0.95rem' }}>
                    {message}
                </p>
                <button onClick={onClose} style={buttonStyle}>
                    Got It
                </button>
            </div>
        </div>
    );
};

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100000,
    padding: '1rem',
};

const modalStyle = {
    background: 'var(--bg-sidebar, #171b18)',
    border: '1px solid var(--border-color, rgba(243, 240, 233, 0.14))',
    padding: '1.75rem',
    borderRadius: '0.75rem',
    maxWidth: '420px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(223, 105, 77, 0.08)',
    color: 'var(--text-primary, #f3f0e9)',
};

const buttonStyle = {
    backgroundColor: 'var(--accent-color, #ef7b5d)',
    color: '#ffffff',
    border: 'none',
    padding: '0.65rem 1.75rem',
    borderRadius: '4px',
    fontFamily: 'var(--font-mono, monospace)',
    fontWeight: '700',
    fontSize: '0.78rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
};

export default ErrorModal;
