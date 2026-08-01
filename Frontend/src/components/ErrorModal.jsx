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
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100000,
};

const modalStyle = {
    background: '#1e1e2e',
    border: '1px solid #33334d',
    padding: '28px',
    borderRadius: '16px',
    maxWidth: '420px',
    width: '90%',
    textAlign: 'center',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
};

const buttonStyle = {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    border: 'none',
    padding: '10px 28px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '0.95rem',
};

export default ErrorModal;
