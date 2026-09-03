import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle, ShieldAlert, CheckCircle, X } from 'lucide-react';
import './ConfirmModal.scss';

export const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed with this change?',
    details = null,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'warning', // 'warning' | 'danger' | 'info' | 'success'
    loading = false
}) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !loading && isOpen) {
                onClose();
            }
        };
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, loading, onClose]);

    if (!isOpen) return null;

    const renderIcon = () => {
        switch (type) {
            case 'danger':
                return <ShieldAlert size={28} className="confirm-icon danger" />;
            case 'success':
                return <CheckCircle size={28} className="confirm-icon success" />;
            case 'info':
                return <AlertCircle size={28} className="confirm-icon info" />;
            case 'warning':
            default:
                return <AlertTriangle size={28} className="confirm-icon warning" />;
        }
    };

    return (
        <div className="confirm-modal-overlay" onClick={!loading ? onClose : undefined}>
            <div 
                className={`confirm-modal-card type-${type}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
            >
                <button 
                    type="button" 
                    className="confirm-modal-close" 
                    onClick={onClose}
                    disabled={loading}
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                <div className="confirm-modal-header">
                    <div className={`confirm-icon-wrapper ${type}`}>
                        {renderIcon()}
                    </div>
                    <div className="confirm-header-text">
                        <h3 id="confirm-modal-title">{title}</h3>
                        <p className="confirm-modal-msg">{message}</p>
                    </div>
                </div>

                {details && (
                    <div className="confirm-details-box">
                        {typeof details === 'string' ? (
                            <p>{details}</p>
                        ) : Array.isArray(details) ? (
                            <ul>
                                {details.map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                ))}
                            </ul>
                        ) : (
                            details
                        )}
                    </div>
                )}

                <div className="confirm-modal-actions">
                    <button
                        type="button"
                        className="btn-confirm-cancel"
                        onClick={onClose}
                        disabled={loading}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className={`btn-confirm-action ${type}`}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="confirm-spinner" />
                        ) : (
                            confirmText
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
