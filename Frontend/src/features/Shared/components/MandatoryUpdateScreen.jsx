import React from 'react';
import { ArrowUpCircle, AlertOctagon, ExternalLink, RefreshCw } from 'lucide-react';
import { CLIENT_APP_VERSION } from '../../../config/version.config';

export const MandatoryUpdateScreen = ({ updateConfig, onRefresh }) => {
    const minVersion = updateConfig?.minimumSupportedVersion || 'Latest';
    const latestVersion = updateConfig?.latestRecommendedVersion || minVersion;
    const updateUrl = updateConfig?.updateUrl || '';
    const announcement = updateConfig?.updateAnnouncement || {};

    const handleUpdateClick = () => {
        if (updateUrl && (updateUrl.startsWith('http://') || updateUrl.startsWith('https://'))) {
            window.location.href = updateUrl;
        } else {
            // For web app, force a full cache-busting reload
            window.location.reload(true);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #090d16 100%)',
            zIndex: 9999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            boxSizing: 'border-box',
            fontFamily: "'Outfit', 'Inter', system-ui, sans-serif"
        }}>
            <div style={{
                maxWidth: '520px',
                width: '100%',
                background: '#0d1322',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '1.25rem',
                padding: '2.5rem',
                boxShadow: '0 0 50px rgba(239, 68, 68, 0.2), 0 30px 60px rgba(0, 0, 0, 0.8)',
                textAlign: 'center',
                boxSizing: 'border-box'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem auto',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                }}>
                    <ArrowUpCircle size={36} color="#ef4444" />
                </div>

                <div style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    marginBottom: '0.75rem'
                }}>
                    Critical Update Required
                </div>

                <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#ffffff', margin: '0 0 0.75rem 0' }}>
                    Application Update Required
                </h1>

                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
                    Your current version of KIVI AI is deprecated and no longer supported. Please update to continue using mock interviews, resume generation, and career tools safely.
                </p>

                {/* Version details card */}
                <div style={{
                    background: '#151b2e',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-around',
                    marginBottom: '1.5rem'
                }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Your Version</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f87171', marginTop: '0.2rem' }}>
                            v{CLIENT_APP_VERSION}
                        </div>
                    </div>
                    <div style={{ width: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Required Minimum</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#10b981', marginTop: '0.2rem' }}>
                            v{minVersion}
                        </div>
                    </div>
                </div>

                {/* Custom Admin Announcement if present */}
                {announcement.message && (
                    <div style={{
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        borderRadius: '10px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        textAlign: 'left'
                    }}>
                        {announcement.title && (
                            <div style={{ fontWeight: '700', color: '#818cf8', fontSize: '0.9rem', marginBottom: '0.35rem' }}>
                                {announcement.title}
                            </div>
                        )}
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                            {announcement.message}
                        </p>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button
                        onClick={handleUpdateClick}
                        style={{
                            padding: '0.85rem 1.5rem',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                            color: '#ffffff',
                            fontWeight: '700',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.35)',
                            transition: 'transform 0.15s ease'
                        }}
                    >
                        <span>Update to v{latestVersion}</span>
                        <ExternalLink size={16} />
                    </button>

                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            style={{
                                padding: '0.65rem 1rem',
                                borderRadius: '10px',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                background: 'transparent',
                                color: '#94a3b8',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            <RefreshCw size={14} />
                            <span>Check Status Again</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

