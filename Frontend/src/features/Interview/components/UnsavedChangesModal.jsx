import React, { useEffect } from 'react';
import { AlertTriangle, X, Save } from 'lucide-react';
import '../../Shared/components/ConfirmModal.scss';
import './UnsavedChangesModal.scss';

export const UnsavedChangesModal = ({
    isOpen,
    onStay,
    onDiscard,
    onSaveAndLeave,
    saveLoading = false
}) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && !saveLoading && isOpen) {
                onStay();
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
    }, [isOpen, saveLoading, onStay]);

    if (!isOpen) return null;

    return (
        <div className="confirm-modal-overlay" onClick={!saveLoading ? onStay : undefined}>
            <div 
                className="confirm-modal-card type-warning unsaved-changes-card"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="unsaved-modal-title"
                aria-describedby="unsaved-modal-desc"
            >
                <button 
                    type="button" 
                    className="confirm-modal-close" 
                    onClick={onStay}
                    disabled={saveLoading}
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>

                <div className="confirm-modal-header">
                    <div className="confirm-icon-wrapper warning">
                        <AlertTriangle size={26} className="confirm-icon warning" />
                    </div>
                    <div className="confirm-header-text">
                        <h3 id="unsaved-modal-title">You have unsaved changes!</h3>
                        <p id="unsaved-modal-desc" className="confirm-modal-msg">
                            Are you sure you want to leave this page? Your changes will be lost if you leave without saving.
                        </p>
                    </div>
                </div>

                <div className="unsaved-modal-actions">
                    <button
                        type="button"
                        className="btn-unsaved-stay"
                        onClick={onStay}
                        disabled={saveLoading}
                    >
                        Stay on Page
                    </button>
                    <button
                        type="button"
                        className="btn-unsaved-discard"
                        onClick={onDiscard}
                        disabled={saveLoading}
                    >
                        Discard Changes
                    </button>
                    <button
                        type="button"
                        className="btn-unsaved-save"
                        onClick={onSaveAndLeave}
                        disabled={saveLoading}
                    >
                        {saveLoading ? (
                            <>
                                <span className="confirm-spinner" />
                                <span>Saving…</span>
                            </>
                        ) : (
                            <>
                                <Save size={14} />
                                <span>Save & Leave</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnsavedChangesModal;
