/**
 * AdminModerationTab.jsx — Content Moderation & Abuse Queue Console
 *
 * Implements:
 * 1. Live moderation queue for prompt injection, harassment, spam, and policy violations.
 * 2. KPI metrics for pending review, critical threats, and pending candidate appeals.
 * 3. Human-in-the-loop decision console: Dismiss, Warn, Restrict Feature, or Suspend.
 * 4. User appeal review and audit trail integration.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    ShieldAlert,
    AlertTriangle,
    ShieldCheck,
    Search,
    RotateCcw,
    Eye,
    CheckCircle2,
    XCircle,
    UserX,
    Sliders,
    MessageSquare,
    AlertOctagon,
    Terminal,
    Ban,
    FileText,
    ArrowUpRight,
    Flag,
    Filter
} from 'lucide-react';
import {
    getAdminModerationQueue,
    getAdminModerationStats,
    applyAdminModerationDecision,
    reviewAdminModerationAppeal
} from '../services/admin.api';

export function AdminModerationTab() {
    const [queue, setQueue] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [actionSubmitting, setActionSubmitting] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState('pending');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [severityFilter, setSeverityFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    // Selected record for Inspector Modal
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [decisionType, setDecisionType] = useState('dismiss');
    const [decisionNotes, setDecisionNotes] = useState('');
    const [targetFeature, setTargetFeature] = useState('aiAssistant');
    const [appealNotes, setAppealNotes] = useState('');

    const fetchStats = useCallback(async () => {
        try {
            setStatsLoading(true);
            const res = await getAdminModerationStats();
            if (res.success) {
                setStats(res.data);
            }
        } catch (err) {
            console.error('Failed to load moderation stats:', err);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    const fetchQueue = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getAdminModerationQueue({
                status: statusFilter,
                category: categoryFilter,
                severity: severityFilter,
                search: searchQuery,
                page,
                limit: 15
            });

            if (res.success) {
                setQueue(res.data || []);
                setTotalPages(res.totalPages || 1);
                setTotalRecords(res.total || 0);
            }
        } catch (err) {
            console.error('Failed to load moderation queue:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, categoryFilter, severityFilter, searchQuery, page]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const handleApplyDecision = async (e) => {
        e.preventDefault();
        if (!selectedRecord) return;

        try {
            setActionSubmitting(true);
            await applyAdminModerationDecision(selectedRecord._id, {
                decision: decisionType,
                notes: decisionNotes,
                targetFeature: decisionType === 'restrict_feature' ? targetFeature : null
            });

            setSelectedRecord(null);
            setDecisionNotes('');
            fetchQueue();
            fetchStats();
        } catch (err) {
            alert(err?.response?.data?.message || err.message || 'Failed to apply moderation decision.');
        } finally {
            setActionSubmitting(false);
        }
    };

    const handleReviewAppeal = async (approved) => {
        if (!selectedRecord) return;
        const confirmMsg = approved 
            ? 'Approve this appeal? This will lift restrictions and mark the incident as resolved.'
            : 'Reject this appeal? The restriction/suspension will remain active.';
        
        if (!window.confirm(confirmMsg)) return;

        try {
            setActionSubmitting(true);
            await reviewAdminModerationAppeal(selectedRecord._id, {
                approved,
                notes: appealNotes || (approved ? 'Appeal accepted by admin' : 'Appeal denied by admin'),
                restoreUser: true
            });

            setSelectedRecord(null);
            setAppealNotes('');
            fetchQueue();
            fetchStats();
        } catch (err) {
            alert(err?.response?.data?.message || err.message || 'Failed to review appeal.');
        } finally {
            setActionSubmitting(false);
        }
    };

    const getSeverityBadge = (severity) => {
        switch (severity) {
            case 'critical':
                return <span className="admin-badge badge-critical" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', textTransform: 'uppercase', fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px' }}>Critical</span>;
            case 'high':
                return <span className="admin-badge badge-high" style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.4)', textTransform: 'uppercase', fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px' }}>High</span>;
            case 'medium':
                return <span className="admin-badge badge-medium" style={{ background: 'rgba(234,179,8,0.2)', color: '#facc15', border: '1px solid rgba(234,179,8,0.4)', textTransform: 'uppercase', fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px' }}>Medium</span>;
            default:
                return <span className="admin-badge badge-low" style={{ background: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)', textTransform: 'uppercase', fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px' }}>Low</span>;
        }
    };

    const getCategoryPill = (category) => {
        const labels = {
            prompt_injection: 'Prompt Injection',
            harassment: 'Harassment',
            spam: 'Spam / Scam',
            policy_violation: 'Policy Violation',
            repeated_abuse: 'Repeated Abuse',
            other: 'Other'
        };
        const colors = {
            prompt_injection: '#c084fc',
            harassment: '#f87171',
            spam: '#fbbf24',
            policy_violation: '#38bdf8',
            repeated_abuse: '#f43f5e',
            other: '#94a3b8'
        };

        return (
            <span style={{ color: colors[category] || '#94a3b8', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Flag size={12} />
                {labels[category] || category}
            </span>
        );
    };

    return (
        <div className="admin-moderation-tab" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header Title & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <ShieldAlert className="text-rose-500" size={24} />
                        Content Moderation & Policy Queue
                    </h2>
                    <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.3rem', marginBottom: 0 }}>
                        Review automated screenings, prompt injection threats, spam floods, and user appeals with granular enforcement controls.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button
                        className="btn-admin-secondary"
                        onClick={() => { fetchStats(); fetchQueue(); }}
                        disabled={loading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                    >
                        <RotateCcw size={14} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
                <div className="admin-kpi-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                        <span>Pending Incidents</span>
                        <AlertTriangle size={16} className="text-amber-400" />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#facc15', marginTop: '0.4rem' }}>
                        {statsLoading ? '...' : (stats?.totalPending ?? 0)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Awaiting human review
                    </div>
                </div>

                <div className="admin-kpi-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                        <span>Critical Threats</span>
                        <AlertOctagon size={16} className="text-rose-400" />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f87171', marginTop: '0.4rem' }}>
                        {statsLoading ? '...' : (stats?.totalCritical ?? 0)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Blocked high-risk attacks
                    </div>
                </div>

                <div className="admin-kpi-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                        <span>Pending Appeals</span>
                        <MessageSquare size={16} className="text-sky-400" />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.4rem' }}>
                        {statsLoading ? '...' : (stats?.totalAppealsPending ?? 0)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Candidate disputes submitted
                    </div>
                </div>

                <div className="admin-kpi-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
                        <span>Prompt Injections</span>
                        <Terminal size={16} className="text-purple-400" />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#c084fc', marginTop: '0.4rem' }}>
                        {statsLoading ? '...' : (stats?.categories?.prompt_injection?.total ?? 0)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Jailbreak & override attempts
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                    {/* Status Tabs */}
                    <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {['pending', 'action_taken', 'dismissed', 'escalated', 'ALL'].map((st) => (
                            <button
                                key={st}
                                onClick={() => { setStatusFilter(st); setPage(1); }}
                                style={{
                                    background: statusFilter === st ? '#4f46e5' : 'transparent',
                                    color: statusFilter === st ? '#fff' : '#94a3b8',
                                    border: 'none',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {st === 'action_taken' ? 'Actioned' : st}
                            </button>
                        ))}
                    </div>

                    {/* Category Select */}
                    <select
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem' }}
                    >
                        <option value="ALL">All Categories</option>
                        <option value="prompt_injection">Prompt Injections</option>
                        <option value="harassment">Harassment / Abuse</option>
                        <option value="spam">Spam / Scams</option>
                        <option value="policy_violation">Policy Violations</option>
                        <option value="repeated_abuse">Repeated Abuse</option>
                    </select>

                    {/* Severity Select */}
                    <select
                        value={severityFilter}
                        onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
                        style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem' }}
                    >
                        <option value="ALL">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>

                {/* Search Box */}
                <div style={{ position: 'relative', minWidth: '220px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                        type="text"
                        placeholder="Search snippet, rule, user..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        style={{
                            background: '#0f172a',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            padding: '5px 10px 5px 30px',
                            color: '#cbd5e1',
                            fontSize: '0.78rem',
                            width: '100%'
                        }}
                    />
                </div>
            </div>

            {/* Moderation Queue Table */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                    <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>Category & Severity</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Target User</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Offending Content Snippet</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Matched Rule</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Flagged At</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                                    Loading moderation incidents...
                                </td>
                            </tr>
                        ) : queue.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                    <ShieldCheck size={32} className="text-emerald-500" style={{ margin: '0 auto 0.5rem', opacity: 0.7 }} />
                                    <div style={{ fontWeight: 600, color: '#cbd5e1' }}>No moderation items matching filters.</div>
                                    <div style={{ fontSize: '0.72rem' }}>All content within platform guidelines.</div>
                                </td>
                            </tr>
                        ) : (
                            queue.map((item) => (
                                <tr
                                    key={item._id}
                                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                    className="admin-table-row"
                                >
                                    {/* Category & Severity */}
                                    <td style={{ padding: '0.8rem 1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {getCategoryPill(item.category)}
                                            <div>{getSeverityBadge(item.severity)}</div>
                                        </div>
                                    </td>

                                    {/* User */}
                                    <td style={{ padding: '0.8rem 1rem' }}>
                                        {item.user ? (
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#f8fafc' }}>{item.user.username}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.user.email}</div>
                                                {item.user.isBlocked && (
                                                    <span style={{ fontSize: '0.65rem', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '1px 5px', borderRadius: '3px' }}>
                                                        Suspended
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span style={{ color: '#64748b', fontStyle: 'italic' }}>Anonymous / Guest</span>
                                        )}
                                    </td>

                                    {/* Snippet */}
                                    <td style={{ padding: '0.8rem 1rem', maxWidth: '300px' }}>
                                        <div style={{
                                            color: '#cbd5e1',
                                            fontFamily: 'monospace',
                                            fontSize: '0.75rem',
                                            background: 'rgba(0,0,0,0.25)',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            "{item.contentSnippet || 'No snippet stored'}"
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                                            Source: {item.contentType}
                                        </div>
                                    </td>

                                    {/* Rule & Confidence */}
                                    <td style={{ padding: '0.8rem 1rem' }}>
                                        <div style={{ color: '#93c5fd', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                                            {item.matchedRule}
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                            Conf: {Math.round((item.confidence || 1) * 100)}%
                                        </div>
                                    </td>

                                    {/* Status & Appeal badge */}
                                    <td style={{ padding: '0.8rem 1rem' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            <span style={{
                                                textTransform: 'uppercase',
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                color: item.status === 'pending' ? '#facc15' : item.status === 'action_taken' ? '#f87171' : item.status === 'dismissed' ? '#4ade80' : '#c084fc'
                                            }}>
                                                {item.status}
                                            </span>
                                            {item.appeal?.status === 'submitted' && (
                                                <span style={{ fontSize: '0.65rem', color: '#38bdf8', background: 'rgba(56,189,248,0.15)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(56,189,248,0.3)' }}>
                                                    Appeal Pending
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Flagged At */}
                                    <td style={{ padding: '0.8rem 1rem', color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                        {new Date(item.createdAt).toLocaleDateString()}
                                        <div style={{ fontSize: '0.68rem' }}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>

                                    {/* Action Button */}
                                    <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                                        <button
                                            onClick={() => {
                                                setSelectedRecord(item);
                                                setDecisionType('dismiss');
                                                setDecisionNotes('');
                                                setAppealNotes('');
                                            }}
                                            style={{
                                                background: '#4f46e5',
                                                border: 'none',
                                                color: '#fff',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <Eye size={12} />
                                            Inspect
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
                    <div>Showing page {page} of {totalPages} ({totalRecords} total items)</div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="btn-admin-secondary"
                            style={{ padding: '4px 10px' }}
                        >
                            Previous
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="btn-admin-secondary"
                            style={{ padding: '4px 10px' }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Inspector & Decision Modal */}
            {selectedRecord && (
                <div className="modal-overlay" onClick={() => setSelectedRecord(null)}>
                    <div
                        className="modal-card"
                        style={{ maxWidth: '640px', width: '95%' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.8rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ShieldAlert size={20} className="text-rose-400" />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                                    Incident Inspection #{selectedRecord._id.slice(-6)}
                                </h3>
                            </div>
                            <button className="modal-close-btn" onClick={() => setSelectedRecord(null)}>✕</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.3rem' }}>
                            {/* Metadata Pills */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '0.5rem' }}>
                                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>CATEGORY</div>
                                    <div style={{ fontWeight: 600, marginTop: '2px' }}>{getCategoryPill(selectedRecord.category)}</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '0.5rem' }}>
                                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>SEVERITY</div>
                                    <div style={{ marginTop: '2px' }}>{getSeverityBadge(selectedRecord.severity)}</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '0.5rem' }}>
                                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>CONFIDENCE</div>
                                    <div style={{ fontWeight: 700, color: '#38bdf8', marginTop: '2px', fontSize: '0.85rem' }}>
                                        {Math.round((selectedRecord.confidence || 1) * 100)}%
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '0.5rem' }}>
                                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>CONTENT SOURCE</div>
                                    <div style={{ fontWeight: 600, color: '#cbd5e1', marginTop: '2px', fontSize: '0.8rem' }}>
                                        {selectedRecord.contentType}
                                    </div>
                                </div>
                            </div>

                            {/* Offending Snippet Display */}
                            <div style={{ background: '#0b1120', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.85rem' }}>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                    <span>Sanitized Content Snippet (Rule: {selectedRecord.matchedRule})</span>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: '#64748b' }}>Max 400 chars stored</span>
                                </div>
                                <div style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                    {selectedRecord.contentSnippet || 'No snippet stored'}
                                </div>
                            </div>

                            {/* User Info Card */}
                            {selectedRecord.user && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.75rem' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Target Account</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>{selectedRecord.user.username}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedRecord.user.email} (Plan: {selectedRecord.user.plan})</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            {selectedRecord.user.isBlocked && (
                                                <span style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', fontSize: '0.68rem', padding: '2px 6px' }}>
                                                    Suspended
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* User Appeal Section if submitted */}
                            {selectedRecord.appeal && selectedRecord.appeal.status === 'submitted' && (
                                <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '8px', padding: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                                        <MessageSquare size={14} />
                                        Candidate Appeal Received
                                    </div>
                                    <p style={{ color: '#cbd5e1', fontSize: '0.8rem', fontStyle: 'italic', margin: '0 0 0.6rem 0' }}>
                                        "{selectedRecord.appeal.reason}"
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleReviewAppeal(true)}
                                            disabled={actionSubmitting}
                                            style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            Approve Appeal & Restore
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleReviewAppeal(false)}
                                            disabled={actionSubmitting}
                                            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            Reject Appeal
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Admin Decision Console */}
                            <form onSubmit={handleApplyDecision} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.85rem' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#f8fafc', marginBottom: '0.6rem' }}>
                                    Take Administrative Action
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {[
                                            { id: 'dismiss', label: 'Dismiss (False Positive)' },
                                            { id: 'warn_user', label: 'Warn User' },
                                            { id: 'restrict_feature', label: 'Restrict Feature' },
                                            { id: 'suspend_user', label: 'Suspend User' },
                                            { id: 'escalate', label: 'Escalate' }
                                        ].map((opt) => (
                                            <label
                                                key={opt.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    background: decisionType === opt.id ? 'rgba(79,70,229,0.25)' : 'rgba(255,255,255,0.03)',
                                                    border: `1px solid ${decisionType === opt.id ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
                                                    borderRadius: '6px',
                                                    padding: '4px 8px',
                                                    fontSize: '0.75rem',
                                                    color: decisionType === opt.id ? '#a5b4fc' : '#cbd5e1',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="decision"
                                                    value={opt.id}
                                                    checked={decisionType === opt.id}
                                                    onChange={(e) => setDecisionType(e.target.value)}
                                                    style={{ display: 'none' }}
                                                />
                                                {opt.label}
                                            </label>
                                        ))}
                                    </div>

                                    {decisionType === 'restrict_feature' && (
                                        <div>
                                            <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Feature to Restrict:</label>
                                            <select
                                                value={targetFeature}
                                                onChange={(e) => setTargetFeature(e.target.value)}
                                                style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '6px', padding: '6px', fontSize: '0.78rem', marginTop: '3px' }}
                                            >
                                                <option value="aiAssistant">AI Assistant Copilot</option>
                                                <option value="resumeGeneration">Resume Generation</option>
                                                <option value="coverLetterGeneration">Cover Letter Generation</option>
                                                <option value="interviewReports">Interview Reports</option>
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Audit Trail Notes / Reason:</label>
                                        <textarea
                                            rows="2"
                                            value={decisionNotes}
                                            onChange={(e) => setDecisionNotes(e.target.value)}
                                            placeholder="Enter justification recorded in Admin Audit Log..."
                                            style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', borderRadius: '6px', padding: '6px', fontSize: '0.78rem', marginTop: '3px', resize: 'vertical' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.3rem' }}>
                                        <button
                                            type="button"
                                            className="btn-cancel"
                                            onClick={() => setSelectedRecord(null)}
                                            style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={actionSubmitting}
                                            className="btn-submit"
                                            style={{
                                                padding: '5px 14px',
                                                fontSize: '0.78rem',
                                                background: decisionType === 'suspend_user' ? '#dc2626' : '#4f46e5'
                                            }}
                                        >
                                            {actionSubmitting ? 'Applying...' : 'Apply Decision'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminModerationTab;

