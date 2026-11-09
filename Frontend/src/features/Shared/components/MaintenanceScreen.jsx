import React from 'react';
import { Wrench, Shield, RefreshCw } from 'lucide-react';

export const MaintenanceScreen = ({ message, onRefresh }) => {
    const defaultMsg = 'KIVI AI is currently undergoing scheduled platform maintenance. Please check back shortly.';

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            background: 'radial-gradient(ellipse at top, #1e293b 0%, #030712 100%)',
            zIndex: 9999998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            boxSizing: 'border-box',
            fontFamily: "'Outfit', 'Inter', system-ui, sans-serif"
        }}>
            <div style={{
                maxWidth: '540px',
                width: '100%',
                background: '#0b0f19',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '1.25rem',
                padding: '2.5rem',
                boxShadow: '0 0 50px rgba(245, 158, 11, 0.15), 0 30px 60px rgba(0, 0, 0, 0.8)',
                textAlign: 'center',
                boxSizing: 'border-box'
            }}>
                <div style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    background: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem auto',
                    border: '1px solid rgba(245, 158, 11, 0.3)'
                }}>
                    <Wrench size={34} color="#f59e0b" />
                </div>

                <div style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#fbbf24',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    marginBottom: '0.75rem'
                }}>
                    Scheduled Maintenance
                </div>

                <h1 style={{ fontSize: '1.65rem', fontWeight: '800', color: '#ffffff', margin: '0 0 0.75rem 0' }}>
                    Platform Under Maintenance
                </h1>

                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 1.75rem 0' }}>
                    {message || defaultMsg}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button
                        onClick={onRefresh || (() => window.location.reload())}
                        style={{
                            padding: '0.85rem 1.5rem',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                            color: '#ffffff',
                            fontWeight: '700',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
                        }}
                    >
                        <RefreshCw size={16} />
                        <span>Check Status & Refresh</span>
                    </button>

                    <a
                        href="/admin-login-secret"
                        style={{
                            marginTop: '0.75rem',
                            color: '#64748b',
                            fontSize: '0.8rem',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#94a3b8'}
                        onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                    >
                        <Shield size={12} />
                        <span>Administrator Access Bypass</span>
                    </a>
                </div>
            </div>
        </div>
    );
};

