import React, { useState, useEffect } from 'react';
import { Laptop, Smartphone, Tablet, ShieldCheck, LogOut, RefreshCw, AlertTriangle } from 'lucide-react';
import { getUserSessions, revokeUserSession, revokeOtherSessions } from '../../Auth/services/auth.api';

export const ActiveSessionsSection = ({ onSessionRevoked }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const fetchSessions = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await getUserSessions();
            if (data?.sessions) {
                setSessions(data.sessions);
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to load active sessions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleRevokeSingle = async (sessionId, isCurrent) => {
        const confirmMsg = isCurrent 
            ? 'Revoking your current session will log you out immediately. Continue?' 
            : 'Revoke this session? This device will be signed out.';
        
        if (!window.confirm(confirmMsg)) return;

        try {
            setActionLoading(sessionId);
            setError('');
            await revokeUserSession(sessionId);

            if (isCurrent) {
                if (onSessionRevoked) {
                    onSessionRevoked();
                } else {
                    window.location.href = '/login';
                }
                return;
            }

            setSuccessMsg('Session successfully revoked.');
            setTimeout(() => setSuccessMsg(''), 4000);
            fetchSessions();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to revoke session.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevokeOthers = async () => {
        if (!window.confirm('Are you sure you want to log out all other devices?')) return;

        try {
            setActionLoading('others');
            setError('');
            const res = await revokeOtherSessions();
            setSuccessMsg(res?.message || 'All other devices signed out.');
            setTimeout(() => setSuccessMsg(''), 4000);
            fetchSessions();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to revoke other sessions.');
        } finally {
            setActionLoading(null);
        }
    };

    const getDeviceIcon = (deviceType) => {
        switch (deviceType?.toLowerCase()) {
            case 'mobile':
                return <Smartphone size={18} className="session-dev-icon mobile" />;
            case 'tablet':
                return <Tablet size={18} className="session-dev-icon tablet" />;
            default:
                return <Laptop size={18} className="session-dev-icon desktop" />;
        }
    };

    const otherSessionsCount = sessions.filter(s => !s.isCurrent).length;

    return (
        <div className="career-profile-section" style={{ marginTop: '2rem' }}>
            <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ShieldCheck size={22} className="section-icon" style={{ color: '#6366f1' }} />
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Active Sessions & Devices</h2>
                        <p className="section-subtitle" style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                            Manage logged-in devices and revoke sessions you don't recognize.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                        className="eval-btn secondary"
                        onClick={fetchSessions} 
                        disabled={loading}
                        title="Refresh sessions"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                    {otherSessionsCount > 0 && (
                        <button
                            className="eval-btn danger"
                            onClick={handleRevokeOthers}
                            disabled={actionLoading === 'others'}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                        >
                            <LogOut size={14} />
                            {actionLoading === 'others' ? 'Revoking...' : `Sign Out Other Devices (${otherSessionsCount})`}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            {successMsg && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontSize: '0.875rem' }}>
                    {successMsg}
                </div>
            )}

            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {loading && sessions.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                        Loading active sessions...
                    </div>
                ) : sessions.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                        No active sessions detected.
                    </div>
                ) : (
                    sessions.map((sess) => (
                        <div 
                            key={sess.sessionId}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem 1.25rem',
                                borderRadius: '10px',
                                background: sess.isCurrent ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                                border: sess.isCurrent ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                                flexWrap: 'wrap',
                                gap: '1rem'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ 
                                    padding: '0.65rem', 
                                    borderRadius: '8px', 
                                    background: sess.isCurrent ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {getDeviceIcon(sess.deviceType)}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>
                                            {sess.browser} on {sess.os}
                                        </span>
                                        {sess.isCurrent && (
                                            <span style={{ 
                                                fontSize: '0.7rem', 
                                                background: '#6366f1', 
                                                color: '#ffffff', 
                                                padding: '0.15rem 0.5rem', 
                                                borderRadius: '12px',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px'
                                            }}>
                                                This Device
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                        <span>IP: {sess.ipAddress}</span>
                                        <span>•</span>
                                        <span>Last active: {sess.lastActiveAt ? new Date(sess.lastActiveAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <button
                                    onClick={() => handleRevokeSingle(sess.sessionId, sess.isCurrent)}
                                    disabled={actionLoading === sess.sessionId}
                                    style={{
                                        padding: '0.45rem 0.85rem',
                                        fontSize: '0.825rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        background: 'transparent',
                                        border: sess.isCurrent ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                                        color: sess.isCurrent ? '#ef4444' : '#cbd5e1',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseOver={(e) => {
                                        e.currentTarget.style.borderColor = '#ef4444';
                                        e.currentTarget.style.color = '#ef4444';
                                    }}
                                    onMouseOut={(e) => {
                                        e.currentTarget.style.borderColor = sess.isCurrent ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.15)';
                                        e.currentTarget.style.color = sess.isCurrent ? '#ef4444' : '#cbd5e1';
                                    }}
                                >
                                    {actionLoading === sess.sessionId ? 'Revoking...' : sess.isCurrent ? 'Log Out' : 'Revoke'}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

