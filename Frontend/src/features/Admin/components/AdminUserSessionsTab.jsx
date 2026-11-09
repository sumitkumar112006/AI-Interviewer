import React, { useState, useEffect } from 'react';
import { ShieldAlert, Laptop, Smartphone, Tablet, RefreshCw, AlertTriangle, LogOut, CheckCircle2, Clock } from 'lucide-react';
import { getAdminUserSessions, revokeAdminSession, revokeAllAdminUserSessions } from '../services/admin.api';

export const AdminUserSessionsTab = ({ userId, user }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const fetchSessions = async () => {
        if (!userId) return;
        try {
            setLoading(true);
            setError('');
            const data = await getAdminUserSessions(userId, { status: statusFilter });
            if (data?.sessions) {
                setSessions(data.sessions);
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to fetch user sessions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, [userId, statusFilter]);

    const handleRevokeSingle = async (sessionId) => {
        const reason = window.prompt(`Revoke session "${sessionId}"?\nEnter reason:`, 'Administrative security action');
        if (reason === null) return; // user cancelled

        try {
            setActionLoading(sessionId);
            setError('');
            await revokeAdminSession(sessionId, reason || 'Revoked by administrator');
            setSuccessMsg(`Session "${sessionId}" revoked.`);
            setTimeout(() => setSuccessMsg(''), 4000);
            fetchSessions();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to revoke session.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRevokeAll = async () => {
        const confirmMsg = `Are you sure you want to revoke ALL active sessions for ${user?.username || 'this user'}? This will disconnect all their devices immediately.`;
        if (!window.confirm(confirmMsg)) return;

        const reason = window.prompt('Enter reason for bulk session revocation:', 'Administrative account security reset');
        if (reason === null) return;

        try {
            setActionLoading('all');
            setError('');
            const res = await revokeAllAdminUserSessions(userId, reason || 'All sessions revoked by administrator');
            setSuccessMsg(res?.message || 'All sessions revoked.');
            setTimeout(() => setSuccessMsg(''), 4000);
            fetchSessions();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to revoke all sessions.');
        } finally {
            setActionLoading(null);
        }
    };

    const getDeviceIcon = (deviceType) => {
        switch (deviceType?.toLowerCase()) {
            case 'mobile':
                return <Smartphone size={16} style={{ color: '#3b82f6' }} />;
            case 'tablet':
                return <Tablet size={16} style={{ color: '#8b5cf6' }} />;
            default:
                return <Laptop size={16} style={{ color: '#10b981' }} />;
        }
    };

    const activeSessionsCount = sessions.filter(s => s.status === 'ACTIVE').length;

    return (
        <div className="doc-tab-content">
            <div className="docs-table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Filter:</label>
                        <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ 
                                background: '#1e293b', 
                                color: '#f8fafc', 
                                border: '1px solid #334155', 
                                borderRadius: '6px', 
                                padding: '0.35rem 0.65rem',
                                fontSize: '0.85rem'
                            }}
                        >
                            <option value="ALL">All Sessions</option>
                            <option value="ACTIVE">Active Only</option>
                            <option value="REVOKED">Revoked Only</option>
                        </select>
                    </div>

                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                        Active Devices: <strong style={{ color: activeSessionsCount > 0 ? '#10b981' : '#64748b' }}>{activeSessionsCount}</strong>
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                        className="eval-btn secondary"
                        onClick={fetchSessions}
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                    {activeSessionsCount > 0 && (
                        <button
                            className="eval-btn danger"
                            onClick={handleRevokeAll}
                            disabled={actionLoading === 'all'}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                        >
                            <ShieldAlert size={14} />
                            {actionLoading === 'all' ? 'Revoking...' : `Revoke All Active (${activeSessionsCount})`}
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            {successMsg && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', fontSize: '0.875rem' }}>
                    {successMsg}
                </div>
            )}

            <div className="docs-table-wrapper">
                <table className="eval-docs-table">
                    <thead>
                        <tr>
                            <th>Device & Browser</th>
                            <th>IP Address</th>
                            <th>Status</th>
                            <th>Last Active</th>
                            <th>Created At</th>
                            <th>Revocation Info</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && sessions.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                    Loading session records...
                                </td>
                            </tr>
                        ) : sessions.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                    No sessions recorded for this user.
                                </td>
                            </tr>
                        ) : (
                            sessions.map((sess) => (
                                <tr key={sess.sessionId}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {getDeviceIcon(sess.deviceType)}
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.875rem' }}>
                                                    {sess.browser}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    {sess.os} • <code style={{ fontSize: '0.7rem' }}>{sess.sessionId.slice(0, 16)}...</code>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <code style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{sess.ipAddress || '—'}</code>
                                    </td>
                                    <td>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '0.2rem 0.55rem',
                                            borderRadius: '12px',
                                            fontWeight: 600,
                                            background: sess.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            color: sess.status === 'ACTIVE' ? '#22c55e' : '#ef4444',
                                            border: sess.status === 'ACTIVE' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                                        }}>
                                            {sess.status}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                                        {sess.lastActiveAt ? new Date(sess.lastActiveAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                        {sess.createdAt ? new Date(sess.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                    </td>
                                    <td>
                                        {sess.status === 'REVOKED' ? (
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                <div>{sess.revokedAt ? new Date(sess.revokedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</div>
                                                {sess.revocationReason && (
                                                    <div style={{ color: '#cbd5e1', fontStyle: 'italic', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {sess.revocationReason}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        {sess.status === 'ACTIVE' ? (
                                            <button
                                                className="eval-btn danger"
                                                onClick={() => handleRevokeSingle(sess.sessionId)}
                                                disabled={actionLoading === sess.sessionId}
                                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                                            >
                                                {actionLoading === sess.sessionId ? 'Revoking...' : 'Revoke'}
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Revoked</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

