import React, { useState } from 'react';
import { Sparkles, X, ArrowRight, ExternalLink } from 'lucide-react';
import { CLIENT_APP_VERSION } from '../../../config/version.config';

export const OptionalUpdateBanner = ({ updateConfig }) => {
    const latestVersion = updateConfig?.latestRecommendedVersion || 'Latest';
    const updateUrl = updateConfig?.updateUrl || '';
    const announcement = updateConfig?.updateAnnouncement || {};

    const dismissKey = `kivi_dismiss_update_${latestVersion}`;
    const [dismissed, setDismissed] = useState(() => {
        return sessionStorage.getItem(dismissKey) === 'true';
    });

    if (dismissed) return null;

    const handleDismiss = () => {
        sessionStorage.setItem(dismissKey, 'true');
        setDismissed(true);
    };

    const handleUpdate = () => {
        if (updateUrl && (updateUrl.startsWith('http://') || updateUrl.startsWith('https://'))) {
            window.open(updateUrl, '_blank', 'noopener,noreferrer');
        } else {
            window.location.reload(true);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            maxWidth: '440px',
            width: 'calc(100vw - 2rem)',
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.25)',
            zIndex: 999998,
            boxSizing: 'border-box',
            fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
            animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        background: 'rgba(99, 102, 241, 0.2)',
                        color: '#818cf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>
                                New Version Available
                            </span>
                            <span style={{
                                fontSize: '0.7rem',
                                background: '#6366f1',
                                color: '#ffffff',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '10px',
                                fontWeight: 600
                            }}>
                                v{latestVersion}
                            </span>
                        </div>
                        <p style={{ margin: '0.35rem 0 0 0', color: '#94a3b8', fontSize: '0.8rem', lineHeight: '1.4' }}>
                            {announcement.title || announcement.message || `Version ${latestVersion} is out with improvements and fixes. (Running v${CLIENT_APP_VERSION})`}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleDismiss}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="Dismiss notification"
                >
                    <X size={16} />
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.85rem' }}>
                <button
                    onClick={handleDismiss}
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#94a3b8',
                        borderRadius: '6px',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                    }}
                >
                    Later
                </button>
                <button
                    onClick={handleUpdate}
                    style={{
                        background: 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)',
                        border: 'none',
                        color: '#ffffff',
                        borderRadius: '6px',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                    }}
                >
                    <span>Update</span>
                    <ArrowRight size={13} />
                </button>
            </div>
        </div>
    );
};

