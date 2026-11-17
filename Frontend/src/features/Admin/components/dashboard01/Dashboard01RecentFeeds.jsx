import React from 'react';
import {
    CreditCard,
    Shield,
    Activity,
    CheckCircle2,
    Clock,
    AlertCircle,
    UserCheck,
    IndianRupee
} from 'lucide-react';

export default function Dashboard01RecentFeeds({ recent, loading }) {
    const recentPayments = recent?.payments || [];
    const recentAudits = recent?.auditActivities || [];

    return (
        <div className="dashboard-01-recent-feeds-grid">
            {/* Feed 1: Recent Successful Payments */}
            <div className="recent-feed-card">
                <div className="feed-header">
                    <div className="title-row">
                        <h4>Recent Settled Transactions</h4>
                        <span className="feed-badge live">PAID LEDGER</span>
                    </div>
                    <p className="feed-sub">Verified real-time subscription & order settlements</p>
                </div>

                <div className="feed-body">
                    {loading ? (
                        <div className="feed-loading">Loading recent transactions...</div>
                    ) : recentPayments.length === 0 ? (
                        <div className="feed-empty">No settled payment transactions found.</div>
                    ) : (
                        <div className="feed-items-list">
                            {recentPayments.map((p, idx) => (
                                <div key={p.id || idx} className="feed-item-row">
                                    <div className="item-icon-box success">
                                        <IndianRupee size={14} />
                                    </div>
                                    <div className="item-main-details">
                                        <div className="item-title">
                                            {p.user?.username || 'Platform User'}
                                            <span className={`plan-mini-pill ${p.user?.plan || 'free'}`}>
                                                {p.user?.plan?.toUpperCase() || 'PLAN'}
                                            </span>
                                        </div>
                                        <div className="item-sub">
                                            {p.user?.email || 'Authenticated Account'} • {p.method}
                                        </div>
                                    </div>
                                    <div className="item-amount-col">
                                        <span className="amount-val">₹{p.amountRupees}</span>
                                        <span className="timestamp-val">
                                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Feed 2: Recent Admin Audit Actions */}
            <div className="recent-feed-card">
                <div className="feed-header">
                    <div className="title-row">
                        <h4>Administrative Audit Stream</h4>
                        <span className="feed-badge audit">RBAC AUDIT</span>
                    </div>
                    <p className="feed-sub">Immutable governance log of security & setting adjustments</p>
                </div>

                <div className="feed-body">
                    {loading ? (
                        <div className="feed-loading">Loading audit events...</div>
                    ) : recentAudits.length === 0 ? (
                        <div className="feed-empty">No admin actions recorded yet.</div>
                    ) : (
                        <div className="feed-items-list">
                            {recentAudits.map((a, idx) => (
                                <div key={a._id || idx} className="feed-item-row">
                                    <div className={`item-icon-box ${a.severity === 'CRITICAL' ? 'critical' : a.severity === 'WARN' ? 'warn' : 'info'}`}>
                                        <Shield size={14} />
                                    </div>
                                    <div className="item-main-details">
                                        <div className="item-title">
                                            {a.eventType || 'ADMIN_ACTION'}
                                            <span className={`severity-mini-pill ${a.severity?.toLowerCase() || 'info'}`}>
                                                {a.severity || 'INFO'}
                                            </span>
                                        </div>
                                        <div className="item-sub">
                                            {a.changeSummary || a.actorRole || 'System Administrator'}
                                        </div>
                                    </div>
                                    <div className="item-timestamp-col">
                                        <span className="timestamp-val">
                                            {a.createdAt ? new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

