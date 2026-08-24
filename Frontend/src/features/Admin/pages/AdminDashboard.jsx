import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    getAdminStats,
    getAdminUsers,
    updateUserRole,
    updateUserPlan,
    toggleUserBlock,
    grantUserCredits,
    createAdminAccount,
    updateUserFeatureAccess,
    sendAdminMessage
} from '../services/admin.api';
import '../styles/admin.scss';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 20 });
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [blockedFilter, setBlockedFilter] = useState('');

    // Modal state for granting custom credits
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
    const [creditIdentifier, setCreditIdentifier] = useState('');
    const [creditAmount, setCreditAmount] = useState(10);
    const [creditMsg, setCreditMsg] = useState({ type: '', text: '' });
    const [creditSubmitting, setCreditSubmitting] = useState(false);

    // Modal state for creating new admin
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [newAdminForm, setNewAdminForm] = useState({ username: '', email: '', password: '', role: 'admin' });
    const [adminMsg, setAdminMsg] = useState({ type: '', text: '' });
    const [adminSubmitting, setAdminSubmitting] = useState(false);

    // Modal state for Admin Broadcast & Direct Messaging
    const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
    const [msgForm, setMsgForm] = useState({ targetType: 'all', targetValue: '', title: '', message: '' });
    const [msgResult, setMsgResult] = useState({ type: '', text: '' });
    const [msgSubmitting, setMsgSubmitting] = useState(false);

    // Modal state for User Evaluation & Feature Control
    const [evalUser, setEvalUser] = useState(null);
    const [evalFeatures, setEvalFeatures] = useState({
        aiAssistant: false,
        resumeGeneration: false,
        coverLetterGeneration: false,
        interviewReports: false
    });
    const [evalMsg, setEvalMsg] = useState({ type: '', text: '' });
    const [evalSubmitting, setEvalSubmitting] = useState(false);

    const fetchStats = async () => {
        try {
            const data = await getAdminStats();
            if (data?.stats) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error("Failed to load admin stats:", err);
        }
    };

    const fetchUsersList = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const data = await getAdminUsers({
                search,
                plan: planFilter,
                role: roleFilter,
                blocked: blockedFilter,
                page,
                limit: 20
            });
            if (data?.users) {
                setUsers(data.users);
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error("Failed to load admin users list:", err);
        } finally {
            setLoading(false);
        }
    }, [search, planFilter, roleFilter, blockedFilter]);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsersList(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchUsersList]);

    const handleRoleChange = async (userId, newRole) => {
        try {
            await updateUserRole(userId, newRole);
            setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
            fetchStats();
            fetchUsersList(pagination.page);
        } catch (err) {
            alert(err?.response?.data?.message || "Failed to update role");
        }
    };

    const handlePlanChange = async (userId, newPlan) => {
        try {
            await updateUserPlan(userId, newPlan);
            setUsers(prev => prev.map(u => u._id === userId ? { ...u, plan: newPlan } : u));
            fetchStats();
        } catch (err) {
            alert(err?.response?.data?.message || "Failed to update plan");
        }
    };

    const handleToggleBlock = async (userId, currentBlockedState) => {
        const nextState = !currentBlockedState;
        const confirmText = nextState ? "Are you sure you want to BLOCK this user?" : "Unblock this user?";
        if (!window.confirm(confirmText)) return;

        try {
            await toggleUserBlock(userId, nextState);
            setUsers(prev => prev.map(u => u._id === userId ? { ...u, isBlocked: nextState } : u));
            fetchStats();
        } catch (err) {
            alert(err?.response?.data?.message || "Failed to toggle block status");
        }
    };

    const handleGrantCreditsSubmit = async (e) => {
        e.preventDefault();
        if (!creditIdentifier.trim()) return;
        setCreditSubmitting(true);
        setCreditMsg({ type: '', text: '' });

        try {
            const res = await grantUserCredits(creditIdentifier.trim(), Number(creditAmount));
            setCreditMsg({ type: 'success', text: res.message });
            setCreditIdentifier('');
            fetchUsersList(pagination.page);
        } catch (err) {
            setCreditMsg({ type: 'error', text: err?.response?.data?.message || "Failed to grant credits" });
        } finally {
            setCreditSubmitting(false);
        }
    };

    const openEvaluationModal = (userObj) => {
        setEvalUser(userObj);
        setEvalFeatures(userObj.blockedFeatures || {
            aiAssistant: false,
            resumeGeneration: false,
            coverLetterGeneration: false,
            interviewReports: false
        });
        setEvalMsg({ type: '', text: '' });
    };

    const handleSaveFeatureAccess = async (e) => {
        e.preventDefault();
        if (!evalUser) return;
        setEvalSubmitting(true);
        setEvalMsg({ type: '', text: '' });

        try {
            const res = await updateUserFeatureAccess(evalUser._id, evalFeatures);
            setEvalMsg({ type: 'success', text: res.message });
            setUsers(prev => prev.map(u => u._id === evalUser._id ? { ...u, blockedFeatures: evalFeatures } : u));
        } catch (err) {
            setEvalMsg({ type: 'error', text: err?.response?.data?.message || "Failed to update feature access" });
        } finally {
            setEvalSubmitting(false);
        }
    };

    const handleCreateAdminSubmit = async (e) => {
        e.preventDefault();
        setAdminSubmitting(true);
        setAdminMsg({ type: '', text: '' });

        try {
            const res = await createAdminAccount(newAdminForm);
            setAdminMsg({ type: 'success', text: res.message });
            setNewAdminForm({ username: '', email: '', password: '', role: 'admin' });
            fetchStats();
            fetchUsersList(1);
        } catch (err) {
            setAdminMsg({ type: 'error', text: err?.response?.data?.message || "Failed to create admin account" });
        } finally {
            setAdminSubmitting(false);
        }
    };

    const handleSendAdminMessageSubmit = async (e) => {
        e.preventDefault();
        if (!msgForm.title.trim() || !msgForm.message.trim()) {
            setMsgResult({ type: 'error', text: 'Notification title and message text are required.' });
            return;
        }
        if (msgForm.targetType === 'user' && !msgForm.targetValue.trim()) {
            setMsgResult({ type: 'error', text: 'User email or ID is required for target type Single User.' });
            return;
        }

        setMsgSubmitting(true);
        setMsgResult({ type: '', text: '' });
        try {
            const res = await sendAdminMessage(msgForm);
            setMsgResult({ type: 'success', text: res.message });
            setMsgForm({ targetType: 'all', targetValue: '', title: '', message: '' });
        } catch (err) {
            setMsgResult({ type: 'error', text: err?.response?.data?.message || 'Failed to send admin message.' });
        } finally {
            setMsgSubmitting(false);
        }
    };

    // View mode state ('overview', 'table', 'summary')
    const [activeTab, setActiveTab] = useState('overview');
    const [hoveredSegment, setHoveredSegment] = useState(null);

    // Calculate chart proportions
    const freeCount = stats?.plans?.free || 0;
    const proCount = stats?.plans?.pro || 0;
    const premCount = stats?.plans?.premium || 0;
    const totalPlanUsers = (freeCount + proCount + premCount) || 1;

    const freePct = Math.round((freeCount / totalPlanUsers) * 100);
    const proPct = Math.round((proCount / totalPlanUsers) * 100);
    const premPct = Math.round((premCount / totalPlanUsers) * 100);

    const reportsCount = stats?.totalReports || 0;
    const coverLettersCount = stats?.totalCoverLetters || 0;
    const maxGenVal = Math.max(reportsCount, coverLettersCount, 1);

    const totalUserAccounts = stats?.totalUsers || 1;
    const blockedCount = stats?.blockedUsers || 0;
    const activeCount = Math.max(0, totalUserAccounts - blockedCount);
    const activePct = Math.round((activeCount / totalUserAccounts) * 100);
    const blockedPct = Math.round((blockedCount / totalUserAccounts) * 100);

    return (
        <div className="admin-dashboard-page">
            {/* Header Navigation */}
            <div className="admin-header-nav">
                <div className="admin-brand">
                    <img src="/Logo.png" alt="Logo" className="admin-logo" />
                    <div>
                        <h1>KIVI Admin Portal</h1>
                    </div>
                    <span className="admin-badge">SUPER ADMIN ACCESS</span>
                </div>

                <div className="admin-top-actions">
                    <button className="credit-btn" style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)' }} onClick={() => { setIsMsgModalOpen(true); setMsgResult({ type: '', text: '' }); }}>
                        <span>📢</span> Send Broadcast / Message
                    </button>
                    <button className="credit-btn" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }} onClick={() => { setIsAdminModalOpen(true); setAdminMsg({ type: '', text: '' }); }}>
                        <span>👑</span> Create New Admin
                    </button>
                    <button className="credit-btn" onClick={() => { setIsCreditModalOpen(true); setCreditMsg({ type: '', text: '' }); }}>
                        <span>⚡</span> Grant Bonus Credits
                    </button>
                    <Link to="/" className="exit-app-btn">
                        Exit to Main App ↗
                    </Link>
                </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="stats-cards-grid">
                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Total Users</span>
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>👥</div>
                    </div>
                    <div className="stat-value">{stats?.totalUsers ?? '...'}</div>
                    <div className="stat-sub">Authenticated Accounts</div>
                </div>

                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Total Admins</span>
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>👑</div>
                    </div>
                    <div className="stat-value">{stats?.totalAdmins ?? '...'}</div>
                    <div className="stat-sub">Platform Administrators</div>
                </div>

                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Interview Reports</span>
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}>📄</div>
                    </div>
                    <div className="stat-value">{stats?.totalReports ?? '...'}</div>
                    <div className="stat-sub">AI Interview Analyses</div>
                </div>

                <div className="stat-card">
                    <div className="stat-header">
                        <span className="stat-title">Plan Tiers</span>
                        <div className="stat-icon-wrapper" style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc' }}>💳</div>
                    </div>
                    <div className="stat-value-pills">
                        <span className="tier-pill pro-pill">{stats?.plans?.pro || 0} Pro</span>
                        <span className="tier-pill prem-pill">{stats?.plans?.premium || 0} Prem</span>
                    </div>
                    <div className="stat-sub">{stats?.plans?.free || 0} Free Tier Users</div>
                </div>
            </div>

            {/* View Mode Tabs */}
            <div className="admin-tab-nav">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <span>📊</span> Graphical Analytics & Trends
                </button>
                <button
                    className={`tab-btn ${activeTab === 'table' ? 'active' : ''}`}
                    onClick={() => setActiveTab('table')}
                >
                    <span>📋</span> User Accounts Table
                </button>
                <button
                    className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                    onClick={() => setActiveTab('summary')}
                >
                    <span>📈</span> Tabular Metrics Summary
                </button>
            </div>

            {/* Tab 1: Graphical Analytics Overview */}
            {activeTab === 'overview' && (
                <div className="charts-grid-container">
                    {/* Donut Chart: Subscription Distribution */}
                    <div className="chart-card">
                        <div className="chart-header">
                            <h3>Subscription Distribution</h3>
                            <span className="chart-badge">HOVER TO EXPLORE TIER</span>
                        </div>
                        <div className="donut-chart-wrapper">
                            <div className="donut-svg-container">
                                <svg className="svg-donut" viewBox="0 0 42 42">
                                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4.2" />
                                    
                                    {/* Free segment */}
                                    <circle
                                        className={`donut-segment ${hoveredSegment === 'free' ? 'active' : ''}`}
                                        cx="21" cy="21" r="15.915" fill="transparent" stroke="#38bdf8"
                                        strokeWidth={hoveredSegment === 'free' ? '5.6' : '4.2'}
                                        strokeDasharray={`${freePct} ${100 - freePct}`} strokeDashoffset="0"
                                        onMouseEnter={() => setHoveredSegment('free')}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                        style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
                                    />
                                    {/* Pro segment */}
                                    <circle
                                        className={`donut-segment ${hoveredSegment === 'pro' ? 'active' : ''}`}
                                        cx="21" cy="21" r="15.915" fill="transparent" stroke="#818cf8"
                                        strokeWidth={hoveredSegment === 'pro' ? '5.6' : '4.2'}
                                        strokeDasharray={`${proPct} ${100 - proPct}`} strokeDashoffset={`-${freePct}`}
                                        onMouseEnter={() => setHoveredSegment('pro')}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                        style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
                                    />
                                    {/* Premium segment */}
                                    <circle
                                        className={`donut-segment ${hoveredSegment === 'premium' ? 'active' : ''}`}
                                        cx="21" cy="21" r="15.915" fill="transparent" stroke="#c084fc"
                                        strokeWidth={hoveredSegment === 'premium' ? '5.6' : '4.2'}
                                        strokeDasharray={`${premPct} ${100 - premPct}`} strokeDashoffset={`-${freePct + proPct}`}
                                        onMouseEnter={() => setHoveredSegment('premium')}
                                        onMouseLeave={() => setHoveredSegment(null)}
                                        style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
                                    />
                                </svg>
                                
                                {/* Center Info Badge */}
                                <div className="donut-center-info">
                                    {hoveredSegment === 'free' && (
                                        <>
                                            <span className="donut-center-label" style={{ color: '#38bdf8' }}>Free Plan</span>
                                            <span className="donut-center-val">{freeCount} ({freePct}%)</span>
                                        </>
                                    )}
                                    {hoveredSegment === 'pro' && (
                                        <>
                                            <span className="donut-center-label" style={{ color: '#818cf8' }}>Pro Plan</span>
                                            <span className="donut-center-val">{proCount} ({proPct}%)</span>
                                        </>
                                    )}
                                    {hoveredSegment === 'premium' && (
                                        <>
                                            <span className="donut-center-label" style={{ color: '#c084fc' }}>Premium Plan</span>
                                            <span className="donut-center-val">{premCount} ({premPct}%)</span>
                                        </>
                                    )}
                                    {!hoveredSegment && (
                                        <>
                                            <span className="donut-center-label">Total Users</span>
                                            <span className="donut-center-val">{stats?.totalUsers || 0}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="chart-legend">
                                <div
                                    className={`legend-item ${hoveredSegment === 'free' ? 'highlighted' : ''}`}
                                    onMouseEnter={() => setHoveredSegment('free')}
                                    onMouseLeave={() => setHoveredSegment(null)}
                                >
                                    <span className="legend-label">
                                        <span className="dot" style={{ background: '#38bdf8' }}></span> Free Plan
                                    </span>
                                    <span className="legend-value">{freeCount} ({freePct}%)</span>
                                </div>
                                <div
                                    className={`legend-item ${hoveredSegment === 'pro' ? 'highlighted' : ''}`}
                                    onMouseEnter={() => setHoveredSegment('pro')}
                                    onMouseLeave={() => setHoveredSegment(null)}
                                >
                                    <span className="legend-label">
                                        <span className="dot" style={{ background: '#818cf8' }}></span> Pro Plan
                                    </span>
                                    <span className="legend-value">{proCount} ({proPct}%)</span>
                                </div>
                                <div
                                    className={`legend-item ${hoveredSegment === 'premium' ? 'highlighted' : ''}`}
                                    onMouseEnter={() => setHoveredSegment('premium')}
                                    onMouseLeave={() => setHoveredSegment(null)}
                                >
                                    <span className="legend-label">
                                        <span className="dot" style={{ background: '#c084fc' }}></span> Premium Plan
                                    </span>
                                    <span className="legend-value">{premCount} ({premPct}%)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bar Chart: Platform Activity */}
                    <div className="chart-card">
                        <div className="chart-header">
                            <h3>Generations & Output Activity</h3>
                            <span className="chart-badge">TOTAL ASSETS</span>
                        </div>
                        <div className="bar-chart-wrapper">
                            <div className="bar-group">
                                <div className="bar-label-row">
                                    <span>Interview Reports Generated</span>
                                    <span>{reportsCount}</span>
                                </div>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${(reportsCount / maxGenVal) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #818cf8)' }}></div>
                                </div>
                            </div>

                            <div className="bar-group">
                                <div className="bar-label-row">
                                    <span>Cover Letters Generated</span>
                                    <span>{coverLettersCount}</span>
                                </div>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${(coverLettersCount / maxGenVal) * 100}%`, background: 'linear-gradient(90deg, #a855f7, #c084fc)' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Health Gauges: Active vs Blocked & Admin Ratio */}
                    <div className="chart-card">
                        <div className="chart-header">
                            <h3>Account Security & Status Ratios</h3>
                            <span className="chart-badge">SYSTEM HEALTH</span>
                        </div>
                        <div className="bar-chart-wrapper">
                            <div className="bar-group">
                                <div className="bar-label-row">
                                    <span>Active Accounts Ratio</span>
                                    <span>{activeCount} ({activePct}%)</span>
                                </div>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${activePct}%`, background: '#22c55e' }}></div>
                                </div>
                            </div>

                            <div className="bar-group">
                                <div className="bar-label-row">
                                    <span>Blocked Accounts Ratio</span>
                                    <span>{blockedCount} ({blockedPct}%)</span>
                                </div>
                                <div className="bar-track">
                                    <div className="bar-fill" style={{ width: `${blockedPct}%`, background: '#ef4444' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 7-Day Timeline Trend Chart */}
                    <div className="chart-card">
                        <div className="chart-header">
                            <h3>7-Day Registration Activity</h3>
                            <span className="chart-badge">RECENT GROWTH</span>
                        </div>
                        <div className="trend-timeline-wrapper">
                            {stats?.dailyRegistrations?.length > 0 ? (
                                stats.dailyRegistrations.map(item => (
                                    <div key={item._id} className="timeline-col">
                                        <div className="col-val">{item.count}</div>
                                        <div className="col-bar-container">
                                            <div className="col-bar" style={{ height: `${Math.min(100, (item.count / Math.max(...stats.dailyRegistrations.map(d => d.count), 1)) * 100)}%` }}></div>
                                        </div>
                                        <div className="col-date">{item._id.slice(5)}</div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', width: '100%', padding: '2rem' }}>
                                    No registrations recorded in last 7 days.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 3: Tabular System Metrics Summary */}
            {activeTab === 'summary' && (
                <div className="users-table-container" style={{ marginBottom: '2rem' }}>
                    <table style={{ minWidth: '100%' }}>
                        <thead>
                            <tr>
                                <th>Metric Category</th>
                                <th>Count / Value</th>
                                <th>Percentage / Share</th>
                                <th>Status / Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Total Registered Users</strong></td>
                                <td>{stats?.totalUsers || 0}</td>
                                <td>100%</td>
                                <td><span className="badge-pill active">ACTIVE DATABASE</span></td>
                            </tr>
                            <tr>
                                <td><strong>Free Plan Users</strong></td>
                                <td>{freeCount}</td>
                                <td>{freePct}%</td>
                                <td><span className="badge-pill free">FREE TIER</span></td>
                            </tr>
                            <tr>
                                <td><strong>Pro Plan Subscribers</strong></td>
                                <td>{proCount}</td>
                                <td>{proPct}%</td>
                                <td><span className="badge-pill pro">PRO TIER</span></td>
                            </tr>
                            <tr>
                                <td><strong>Premium Plan Subscribers</strong></td>
                                <td>{premCount}</td>
                                <td>{premPct}%</td>
                                <td><span className="badge-pill premium">PREMIUM TIER</span></td>
                            </tr>
                            <tr>
                                <td><strong>Administrators (admins table)</strong></td>
                                <td>{stats?.totalAdmins || 0}</td>
                                <td>-</td>
                                <td><span className="badge-pill role-admin">SUPER ADMIN ACCESS</span></td>
                            </tr>
                            <tr>
                                <td><strong>Blocked Accounts</strong></td>
                                <td>{blockedCount}</td>
                                <td>{blockedPct}%</td>
                                <td><span className="badge-pill blocked">{blockedCount > 0 ? 'RESTRICTED' : 'CLEAN'}</span></td>
                            </tr>
                            <tr>
                                <td><strong>Total Interview Analyses Generated</strong></td>
                                <td>{reportsCount}</td>
                                <td>-</td>
                                <td><span className="badge-pill active">COMPLETED</span></td>
                            </tr>
                            <tr>
                                <td><strong>Total Cover Letters Generated</strong></td>
                                <td>{coverLettersCount}</td>
                                <td>-</td>
                                <td><span className="badge-pill active">COMPLETED</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Tab 2 (or Default): User Accounts Table with Pagination */}
            {(activeTab === 'table' || activeTab === 'overview') && (
                <>
                    {/* Toolbar Filters */}
                    <div className="users-toolbar">
                        <div className="search-box">
                            <input
                                type="text"
                                placeholder="Search by Username or Email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                                <option value="">All Plans</option>
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="premium">Premium</option>
                            </select>

                            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                                <option value="">All Roles</option>
                                <option value="user">Users Collection</option>
                                <option value="admin">Admins Collection (Admin)</option>
                                <option value="super_admin">Admins Collection (Super Admin)</option>
                            </select>

                            <select value={blockedFilter} onChange={(e) => setBlockedFilter(e.target.value)}>
                                <option value="">All Statuses</option>
                                <option value="false">Active Only</option>
                                <option value="true">Blocked Only</option>
                            </select>
                        </div>
                    </div>

                    {/* Users Data Table */}
                    <div className="users-table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>User Account</th>
                                    <th>Role & Table</th>
                                    <th>Current Plan</th>
                                    <th>Reports</th>
                                    <th>Cover Letters</th>
                                    <th>Bonus Credits</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                            Loading accounts...
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                                            No accounts matching the filters.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((u) => (
                                        <tr key={u._id}>
                                            <td>
                                                <Link to={`/admin-portal-dashboard-root/user-evaluation/${u._id}`} className="user-cell" style={{ cursor: 'pointer', textDecoration: 'none' }} title="Click to Evaluate & Control Feature Access">
                                                    <div className="avatar-circle" style={['admin', 'super_admin'].includes(u.role) ? { background: 'linear-gradient(135deg, #ef4444, #f97316)' } : {}}>
                                                        {(u.username || "U")[0].toUpperCase()}
                                                    </div>
                                                    <div className="user-details">
                                                        <div className="user-name" style={{ color: '#818cf8', textDecoration: 'underline' }}>{u.username}</div>
                                                        <div className="user-email">{u.email}</div>
                                                    </div>
                                                </Link>
                                            </td>
                                            <td>
                                                <select
                                                    className="action-select"
                                                    value={u.role || 'user'}
                                                    onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                                >
                                                    <option value="user">User (users table)</option>
                                                    <option value="admin">Admin (admins table)</option>
                                                    <option value="super_admin">Super Admin (admins table)</option>
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    className="action-select"
                                                    value={(u.plan || 'free').toLowerCase()}
                                                    onChange={(e) => handlePlanChange(u._id, e.target.value)}
                                                >
                                                    <option value="free">Free</option>
                                                    <option value="pro">Pro</option>
                                                    <option value="premium">Premium</option>
                                                </select>
                                            </td>
                                            <td>
                                                <strong>{u.totalReports || 0}</strong>
                                            </td>
                                            <td>
                                                <strong>{u.totalCoverLetters || 0}</strong>
                                            </td>
                                            <td>
                                                <span style={{ color: u.customBonusCredits ? '#818cf8' : '#94a3b8', fontWeight: u.customBonusCredits ? 700 : 400 }}>
                                                    +{u.customBonusCredits || 0}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`badge-pill ${u.isBlocked ? 'blocked' : 'active'}`}>
                                                    {u.isBlocked ? 'BLOCKED' : 'ACTIVE'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <Link
                                                        to={`/admin-portal-dashboard-root/user-evaluation/${u._id}`}
                                                        className="credit-btn"
                                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#818cf8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                                    >
                                                        ⚙️ Evaluate Account
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className={`block-btn ${u.isBlocked ? 'unblock' : 'block'}`}
                                                        onClick={() => handleToggleBlock(u._id, u.isBlocked)}
                                                    >
                                                        {u.isBlocked ? 'Unblock' : 'Block'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="pagination-bar">
                        <div className="page-info">
                            Showing page <strong>{pagination.page}</strong> of <strong>{pagination.pages || 1}</strong> (Total <strong>{pagination.total}</strong> accounts)
                        </div>
                        <div className="page-buttons">
                            <button
                                className="page-btn"
                                disabled={pagination.page <= 1 || loading}
                                onClick={() => fetchUsersList(pagination.page - 1)}
                            >
                                ← Previous Page
                            </button>
                            <button
                                className="page-btn"
                                disabled={pagination.page >= pagination.pages || loading}
                                onClick={() => fetchUsersList(pagination.page + 1)}
                            >
                                Next Page →
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Modal for User Evaluation & Granular Feature Control */}
            {evalUser && (
                <div className="modal-overlay" onClick={() => setEvalUser(null)}>
                    <div className="modal-card evaluation-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                <div className="avatar-circle" style={{ width: '42px', height: '42px', fontSize: '1.2rem' }}>
                                    {(evalUser.username || "U")[0].toUpperCase()}
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#ffffff' }}>User Evaluation & Feature Control</h2>
                                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{evalUser.email} (ID: {evalUser._id})</span>
                                </div>
                            </div>
                            <button onClick={() => setEvalUser(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        {/* Account Quick Metrics */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>PLAN</div>
                                <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.9rem' }}>{(evalUser.plan || 'free').toUpperCase()}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>REPORTS</div>
                                <div style={{ fontWeight: 800, color: '#818cf8', fontSize: '0.9rem' }}>{evalUser.totalReports || 0}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>COVER LETTERS</div>
                                <div style={{ fontWeight: 800, color: '#c084fc', fontSize: '0.9rem' }}>{evalUser.totalCoverLetters || 0}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>BONUS CREDITS</div>
                                <div style={{ fontWeight: 800, color: '#4ade80', fontSize: '0.9rem' }}>+{evalUser.customBonusCredits || 0}</div>
                            </div>
                        </div>

                        {evalMsg.text && (
                            <div style={{
                                padding: '0.6rem 0.9rem',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                marginBottom: '1rem',
                                background: evalMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                color: evalMsg.type === 'error' ? '#f87171' : '#4ade80',
                                border: `1px solid ${evalMsg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                            }}>
                                {evalMsg.text}
                            </div>
                        )}

                        <form onSubmit={handleSaveFeatureAccess}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#e2e8f0', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>
                                🔒 Granular Feature Access Permissions
                            </h3>

                            <div className="feature-toggle-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                {/* AI Assistant Access */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem' }}>🤖 AI Assistant & Section Writer</div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>AI resume section rewriter and optimization assistant</div>
                                    </div>
                                    <button
                                        type="button"
                                        style={{
                                            padding: '0.4rem 0.85rem',
                                            borderRadius: '8px',
                                            fontWeight: 800,
                                            fontSize: '0.8rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: evalFeatures.aiAssistant ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                            color: evalFeatures.aiAssistant ? '#f87171' : '#4ade80'
                                        }}
                                        onClick={() => setEvalFeatures(prev => ({ ...prev, aiAssistant: !prev.aiAssistant }))}
                                    >
                                        {evalFeatures.aiAssistant ? '❌ BLOCKED' : '✅ ALLOWED'}
                                    </button>
                                </div>

                                {/* Mock Interview & Report Access */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem' }}>📄 Mock Interview & Report Generation</div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Full AI mock interview questions and score analysis</div>
                                    </div>
                                    <button
                                        type="button"
                                        style={{
                                            padding: '0.4rem 0.85rem',
                                            borderRadius: '8px',
                                            fontWeight: 800,
                                            fontSize: '0.8rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: evalFeatures.interviewReports ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                            color: evalFeatures.interviewReports ? '#f87171' : '#4ade80'
                                        }}
                                        onClick={() => setEvalFeatures(prev => ({ ...prev, interviewReports: !prev.interviewReports }))}
                                    >
                                        {evalFeatures.interviewReports ? '❌ BLOCKED' : '✅ ALLOWED'}
                                    </button>
                                </div>

                                {/* Cover Letter & CV Access */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem' }}>✍️ Cover Letter & CV Generation</div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Tailored job application cover letters</div>
                                    </div>
                                    <button
                                        type="button"
                                        style={{
                                            padding: '0.4rem 0.85rem',
                                            borderRadius: '8px',
                                            fontWeight: 800,
                                            fontSize: '0.8rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: evalFeatures.coverLetterGeneration ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                            color: evalFeatures.coverLetterGeneration ? '#f87171' : '#4ade80'
                                        }}
                                        onClick={() => setEvalFeatures(prev => ({ ...prev, coverLetterGeneration: !prev.coverLetterGeneration }))}
                                    >
                                        {evalFeatures.coverLetterGeneration ? '❌ BLOCKED' : '✅ ALLOWED'}
                                    </button>
                                </div>

                                {/* Resume Generation Access */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.9rem' }}>📝 Resume Builder & PDF Generation</div>
                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Resume creation, template editing, and PDF download</div>
                                    </div>
                                    <button
                                        type="button"
                                        style={{
                                            padding: '0.4rem 0.85rem',
                                            borderRadius: '8px',
                                            fontWeight: 800,
                                            fontSize: '0.8rem',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: evalFeatures.resumeGeneration ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                            color: evalFeatures.resumeGeneration ? '#f87171' : '#4ade80'
                                        }}
                                        onClick={() => setEvalFeatures(prev => ({ ...prev, resumeGeneration: !prev.resumeGeneration }))}
                                    >
                                        {evalFeatures.resumeGeneration ? '❌ BLOCKED' : '✅ ALLOWED'}
                                    </button>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setEvalUser(null)}>
                                    Close
                                </button>
                                <button type="submit" className="btn-submit" disabled={evalSubmitting}>
                                    {evalSubmitting ? 'Saving Access...' : 'Save Permissions'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Creating New Admin */}
            {isAdminModalOpen && (
                <div className="modal-overlay" onClick={() => setIsAdminModalOpen(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h2>👑 Create New Admin Account</h2>
                        <p>Directly register a new administrator in the dedicated <code>admins</code> collection.</p>

                        {adminMsg.text && (
                            <div style={{
                                padding: '0.6rem 0.9rem',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                marginBottom: '1rem',
                                background: adminMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                color: adminMsg.type === 'error' ? '#f87171' : '#4ade80',
                                border: `1px solid ${adminMsg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                            }}>
                                {adminMsg.text}
                            </div>
                        )}

                        <form onSubmit={handleCreateAdminSubmit}>
                            <div className="form-group">
                                <label>Admin Username</label>
                                <input
                                    type="text"
                                    placeholder="e.g. SystemAdmin"
                                    value={newAdminForm.username}
                                    onChange={(e) => setNewAdminForm(prev => ({ ...prev, username: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Admin Email Address</label>
                                <input
                                    type="email"
                                    placeholder="e.g. admin@domain.com"
                                    value={newAdminForm.email}
                                    onChange={(e) => setNewAdminForm(prev => ({ ...prev, email: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Password</label>
                                <input
                                    type="password"
                                    placeholder="••••••••••••"
                                    value={newAdminForm.password}
                                    onChange={(e) => setNewAdminForm(prev => ({ ...prev, password: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Admin Role Hierarchy</label>
                                <select
                                    style={{ width: '100%', padding: '0.65rem 0.85rem', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#ffffff', borderRadius: '8px' }}
                                    value={newAdminForm.role}
                                    onChange={(e) => setNewAdminForm(prev => ({ ...prev, role: e.target.value }))}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setIsAdminModalOpen(false)}>
                                    Close
                                </button>
                                <button type="submit" className="btn-submit" disabled={adminSubmitting}>
                                    {adminSubmitting ? 'Creating...' : 'Create Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Granting Credits */}
            {isCreditModalOpen && (
                <div className="modal-overlay" onClick={() => setIsCreditModalOpen(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <h2>⚡ Grant Custom Bonus Credits</h2>
                        <p>Increase generation attempt limit for a specific user by Email or User ID.</p>

                        {creditMsg.text && (
                            <div style={{
                                padding: '0.6rem 0.9rem',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                marginBottom: '1rem',
                                background: creditMsg.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                color: creditMsg.type === 'error' ? '#f87171' : '#4ade80',
                                border: `1px solid ${creditMsg.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                            }}>
                                {creditMsg.text}
                            </div>
                        )}

                        <form onSubmit={handleGrantCreditsSubmit}>
                            <div className="form-group">
                                <label>User Email or User ID</label>
                                <input
                                    type="text"
                                    placeholder="e.g. user@gmail.com or 64b8f..."
                                    value={creditIdentifier}
                                    onChange={(e) => setCreditIdentifier(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Bonus Credits Offset (Positive to Add, Negative to Reduce)</label>
                                <input
                                    type="number"
                                    min="-500"
                                    max="1000"
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setIsCreditModalOpen(false)}>
                                    Close
                                </button>
                                <button type="submit" className="btn-submit" disabled={creditSubmitting}>
                                    {creditSubmitting ? 'Granting...' : 'Grant Credits'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Send Admin Broadcast / Message */}
            {isMsgModalOpen && (
                <div className="admin-modal-overlay" onClick={() => setIsMsgModalOpen(false)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📢 Send Admin Broadcast / Message</h3>
                            <button className="close-btn" onClick={() => setIsMsgModalOpen(false)}>✕</button>
                        </div>

                        {msgResult.text && (
                            <div className="modal-msg" style={{
                                padding: '0.65rem 0.85rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.82rem',
                                marginBottom: '1rem',
                                background: msgResult.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                color: msgResult.type === 'error' ? '#f87171' : '#4ade80',
                                border: `1px solid ${msgResult.type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`
                            }}>
                                {msgResult.text}
                            </div>
                        )}

                        <form onSubmit={handleSendAdminMessageSubmit}>
                            <div className="form-group">
                                <label>Target Audience Scope</label>
                                <select
                                    value={msgForm.targetType}
                                    onChange={(e) => setMsgForm({ ...msgForm, targetType: e.target.value, targetValue: '' })}
                                    className="action-select"
                                    style={{ width: '100%', padding: '0.75rem', background: '#090e17', border: '1px solid #1e293b', color: '#fff', borderRadius: '0.65rem' }}
                                >
                                    <option value="all">🌐 All Users (Platform-wide)</option>
                                    <option value="free">🆓 Free Plan Users</option>
                                    <option value="pro">⚡ Pro Plan Users</option>
                                    <option value="premium">💎 Premium Plan Users</option>
                                    <option value="user">👤 Individual User (By Email / User ID)</option>
                                </select>
                            </div>

                            {msgForm.targetType === 'user' && (
                                <div className="form-group">
                                    <label>User Email or User ID</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. user@gmail.com or 64b8f..."
                                        value={msgForm.targetValue}
                                        onChange={(e) => setMsgForm({ ...msgForm, targetValue: e.target.value })}
                                        required
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label>Notification Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g. System Maintenance Notice / Special Offer"
                                    value={msgForm.title}
                                    onChange={(e) => setMsgForm({ ...msgForm, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Message Content</label>
                                <textarea
                                    rows="4"
                                    placeholder="Write your message to the user(s)..."
                                    value={msgForm.message}
                                    onChange={(e) => setMsgForm({ ...msgForm, message: e.target.value })}
                                    style={{ width: '100%', padding: '0.65rem', background: '#090e17', border: '1px solid #1e293b', color: '#fff', borderRadius: '0.5rem', resize: 'vertical' }}
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setIsMsgModalOpen(false)}>
                                    Close
                                </button>
                                <button type="submit" className="btn-submit" disabled={msgSubmitting}>
                                    {msgSubmitting ? 'Sending...' : '🚀 Send Message'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
