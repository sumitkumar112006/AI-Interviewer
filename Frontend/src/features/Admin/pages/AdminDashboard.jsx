import React, { useEffect, useState, useCallback, useTransition } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../Auth/hooks/useAuth';
import {
    getAdminStats,
    getAdminUsers,
    updateUserRole,
    updateUserPlan,
    toggleUserBlock,
    deleteUser,
    grantUserCredits,
    createAdminAccount,
    updateUserFeatureAccess,
    sendAdminMessage
} from '../services/admin.api';

import AdminSidebar from '../components/AdminSidebar';
import AdminTopNav from '../components/AdminTopNav';
import { AdminPaymentsTab } from '../components/AdminPaymentsTab';
import { AdminSubscriptionsTab } from '../components/AdminSubscriptionsTab';
import { AdminAuditLogsTab } from '../components/AdminAuditLogsTab';
import { AdminFeatureMatrixTab } from '../components/AdminFeatureMatrixTab';
import { AdminBroadcastTab } from '../components/AdminBroadcastTab';
import { AdminManagementTab } from '../components/AdminManagementTab';
import { AdminCreditsTab } from '../components/AdminCreditsTab';
import AdminPagination from '../components/AdminPagination';
import ConfirmModal from '../../Shared/components/ConfirmModal';

import {
    Activity,
    Users,
    SlidersHorizontal,
    CreditCard,
    Layers,
    FileClock,
    Megaphone,
    UserPlus,
    Sparkles,
    Shield,
    Trash2,
    Lock,
    Unlock,
    Sliders,
    ArrowUpRight,
    Search,
    RotateCcw,
    Check,
    X,
    ExternalLink,
    ChevronRight,
    TrendingUp
} from 'lucide-react';

import '../styles/admin.scss';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { user: authUser, handleLogout } = useAuth();
    const [isPending, startTransition] = useTransition();

    // Console Layout State (Minimizable & Adjustable width)
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('kivi_admin_sidebar_collapsed') === 'true';
    });
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('kivi_admin_sidebar_width');
        return saved ? Number(saved) : 240;
    });

    useEffect(() => {
        localStorage.setItem('kivi_admin_sidebar_collapsed', isCollapsed.toString());
    }, [isCollapsed]);

    // Active console view: 'overview' | 'table' | 'feature-matrix' | 'payments' | 'subscriptions' | 'audit-logs' | 'broadcast' | 'admins' | 'credits'
    const [activeTab, setActiveTab] = useState('overview');

    // Data States
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1, limit: 20 });
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [blockedFilter, setBlockedFilter] = useState('');

    // Modal state for quick action from TopNav
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
    const [creditIdentifier, setCreditIdentifier] = useState('');
    const [creditAmount, setCreditAmount] = useState(10);
    const [creditMsg, setCreditMsg] = useState({ type: '', text: '' });
    const [creditSubmitting, setCreditSubmitting] = useState(false);

    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [newAdminForm, setNewAdminForm] = useState({ username: '', email: '', password: '', role: 'admin' });
    const [adminMsg, setAdminMsg] = useState({ type: '', text: '' });
    const [adminSubmitting, setAdminSubmitting] = useState(false);

    const [isMsgModalOpen, setIsMsgModalOpen] = useState(false);
    const [msgForm, setMsgForm] = useState({ targetType: 'all', targetValue: '', title: '', message: '' });
    const [msgResult, setMsgResult] = useState({ type: '', text: '' });
    const [msgSubmitting, setMsgSubmitting] = useState(false);

    // Modal state for User Evaluation & Granular Feature Control
    const [evalUser, setEvalUser] = useState(null);
    const [evalFeatures, setEvalFeatures] = useState({
        aiAssistant: false,
        resumeGeneration: false,
        coverLetterGeneration: false,
        interviewReports: false
    });
    const [evalMsg, setEvalMsg] = useState({ type: '', text: '' });
    const [evalSubmitting, setEvalSubmitting] = useState(false);

    // Donut hover highlight
    const [hoveredSegment, setHoveredSegment] = useState(null);

    // Confirmation Action Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        details: null,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        type: 'warning',
        loading: false,
        onConfirm: null
    });

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

    const handleRefreshAll = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([fetchStats(), fetchUsersList(pagination.page)]);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await handleLogout();
            navigate('/admin-login-secret');
        } catch (err) {
            console.error('Logout error:', err);
            navigate('/admin-login-secret');
        }
    };

    // User Role Change
    const requestRoleChange = (userObj, newRole) => {
        if (userObj.role === newRole) return;
        setConfirmModal({
            isOpen: true,
            title: 'Confirm Security Role Change',
            message: `Update security access role for "${userObj.username}"?`,
            details: (
                <div className="change-preview-row">
                    <span className="change-label">Role Update:</span>
                    <span className="change-value">
                        <span className="old-val">{userObj.role?.toUpperCase() || 'USER'}</span>
                        <span className="arrow">→</span>
                        <span className="new-val" style={{ color: ['admin', 'super_admin'].includes(newRole) ? '#f87171' : '#38bdf8' }}>
                            {newRole.toUpperCase()}
                        </span>
                    </span>
                </div>
            ),
            confirmText: 'Update Role',
            cancelText: 'Cancel',
            type: ['admin', 'super_admin'].includes(newRole) ? 'danger' : 'warning',
            loading: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, loading: true }));
                try {
                    await updateUserRole(userObj._id, newRole);
                    setUsers(prev => prev.map(u => u._id === userObj._id ? { ...u, role: newRole } : u));
                    fetchStats();
                    fetchUsersList(pagination.page);
                    setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
                } catch (err) {
                    alert(err?.response?.data?.message || "Failed to update role");
                    setConfirmModal(prev => ({ ...prev, loading: false }));
                }
            }
        });
    };

    // User Plan Change
    const requestPlanChange = (userObj, newPlan) => {
        if (userObj.plan === newPlan) return;
        setConfirmModal({
            isOpen: true,
            title: 'Confirm Subscription Plan Change',
            message: `Update subscription plan tier for "${userObj.username}"?`,
            details: (
                <div className="change-preview-row">
                    <span className="change-label">Plan Update:</span>
                    <span className="change-value">
                        <span className="old-val">{userObj.plan?.toUpperCase() || 'FREE'}</span>
                        <span className="arrow">→</span>
                        <span className="new-val" style={{ color: '#818cf8' }}>{newPlan.toUpperCase()}</span>
                    </span>
                </div>
            ),
            confirmText: 'Change Plan',
            cancelText: 'Cancel',
            type: newPlan === 'free' ? 'warning' : 'info',
            loading: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, loading: true }));
                try {
                    await updateUserPlan(userObj._id, newPlan);
                    setUsers(prev => prev.map(u => u._id === userObj._id ? { ...u, plan: newPlan } : u));
                    fetchStats();
                    setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
                } catch (err) {
                    alert(err?.response?.data?.message || "Failed to update plan");
                    setConfirmModal(prev => ({ ...prev, loading: false }));
                }
            }
        });
    };

    // User Block/Unblock
    const requestToggleBlock = (userObj) => {
        const nextState = !userObj.isBlocked;
        setConfirmModal({
            isOpen: true,
            title: nextState ? 'Confirm Account Suspension' : 'Confirm Account Re-Activation',
            message: nextState
                ? `Suspend platform generation and practice access for "${userObj.username}"?`
                : `Restore full platform generation and practice access for "${userObj.username}"?`,
            details: (
                <div className="change-preview-row">
                    <span className="change-label">Account Status:</span>
                    <span className="change-value">
                        <span className="old-val">{userObj.isBlocked ? 'SUSPENDED' : 'ACTIVE'}</span>
                        <span className="arrow">→</span>
                        <span className="new-val" style={{ color: nextState ? '#ef4444' : '#22c55e' }}>
                            {nextState ? 'SUSPENDED' : 'ACTIVE'}
                        </span>
                    </span>
                </div>
            ),
            confirmText: nextState ? 'Suspend Account' : 'Reactivate Account',
            cancelText: 'Cancel',
            type: nextState ? 'danger' : 'success',
            loading: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, loading: true }));
                try {
                    await toggleUserBlock(userObj._id, nextState);
                    setUsers(prev => prev.map(u => u._id === userObj._id ? { ...u, isBlocked: nextState } : u));
                    fetchStats();
                    setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
                } catch (err) {
                    alert(err?.response?.data?.message || "Failed to toggle account status");
                    setConfirmModal(prev => ({ ...prev, loading: false }));
                }
            }
        });
    };

    // User Delete
    const requestDeleteUser = (userObj) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete User Account Permanently',
            message: `Permanently delete account "${userObj.username}" (${userObj.email}) and purge associated mock interviews, resumes, and logs?`,
            details: (
                <div className="change-preview-row">
                    <span className="change-label">Purge Target:</span>
                    <span className="change-value">
                        <span className="new-val" style={{ color: '#ef4444' }}>{userObj.username}</span>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}> ({userObj.email})</span>
                    </span>
                </div>
            ),
            confirmText: 'Delete Permanently',
            cancelText: 'Cancel',
            type: 'danger',
            loading: false,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, loading: true }));
                try {
                    await deleteUser(userObj._id);
                    setUsers(prev => prev.filter(u => u._id !== userObj._id));
                    fetchStats();
                    fetchUsersList(pagination.page);
                    setConfirmModal(prev => ({ ...prev, isOpen: false, loading: false }));
                } catch (err) {
                    alert(err?.response?.data?.message || "Failed to delete user");
                    setConfirmModal(prev => ({ ...prev, loading: false }));
                }
            }
        });
    };

    // Modal Credits Submit
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

    // Modal Admin Submit
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

    // Modal Broadcast Submit
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

    // Feature Access Modal
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

    // Visual Charts Proportions
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
        <div className="kivi-admin-shell">
            {/* Minimizable & Adjustable Google Vertex AI Style Sidebar */}
            <AdminSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                sidebarWidth={sidebarWidth}
                setSidebarWidth={setSidebarWidth}
                userCount={stats?.totalUsers || 0}
                adminCount={stats?.totalAdmins || 0}
                onLogout={handleSignOut}
            />

            {/* Main Console Area */}
            <div className="admin-main-container">
                {/* Vertex AI Header Navigation Bar */}
                <AdminTopNav
                    activeTab={activeTab}
                    searchTerm={search}
                    setSearchTerm={setSearch}
                    onRefresh={handleRefreshAll}
                    isRefreshing={isRefreshing}
                    onOpenBroadcastModal={() => { setIsMsgModalOpen(true); setMsgResult({ type: '', text: '' }); }}
                    onOpenCreditsModal={() => { setIsCreditModalOpen(true); setCreditMsg({ type: '', text: '' }); }}
                    onOpenAdminModal={() => { setIsAdminModalOpen(true); setAdminMsg({ type: '', text: '' }); }}
                    isSidebarCollapsed={isCollapsed}
                    setIsSidebarCollapsed={setIsCollapsed}
                    adminUser={authUser}
                    onLogout={handleSignOut}
                />

                {/* Main Content Workspace */}
                <main className="admin-workspace">
                    {/* View 1: Overview & Analytics */}
                    {activeTab === 'overview' && (
                        <div className="overview-view-container">
                            {/* Primary Metric KPI Cards */}
                            <div className="stats-cards-grid">
                                <div className="stat-card">
                                    <div className="stat-header">
                                        <span className="stat-title">Authenticated Users</span>
                                        <div className="stat-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                                            <Users size={17} />
                                        </div>
                                    </div>
                                    <div className="stat-value">{stats?.totalUsers ?? '...'}</div>
                                    <div className="stat-sub">
                                        <span style={{ color: '#22c55e', fontWeight: 700 }}>{activeCount} Active</span> • {blockedCount} Restricted
                                    </div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-header">
                                        <span className="stat-title">Platform Admins</span>
                                        <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171' }}>
                                            <Shield size={17} />
                                        </div>
                                    </div>
                                    <div className="stat-value">{stats?.totalAdmins ?? '...'}</div>
                                    <div className="stat-sub">Elevated Security Roles</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-header">
                                        <span className="stat-title">Mock Interview Reports</span>
                                        <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8' }}>
                                            <Activity size={17} />
                                        </div>
                                    </div>
                                    <div className="stat-value">{stats?.totalReports ?? '...'}</div>
                                    <div className="stat-sub">Score Analyses Completed</div>
                                </div>

                                <div className="stat-card">
                                    <div className="stat-header">
                                        <span className="stat-title">Paid Plan Subscriptions</span>
                                        <div className="stat-icon-wrapper" style={{ background: 'rgba(192, 132, 252, 0.12)', color: '#c084fc' }}>
                                            <Layers size={17} />
                                        </div>
                                    </div>
                                    <div className="stat-value-pills">
                                        <span className="tier-pill pro-pill">{stats?.plans?.pro || 0} Pro</span>
                                        <span className="tier-pill prem-pill">{stats?.plans?.premium || 0} Premium</span>
                                    </div>
                                    <div className="stat-sub">{stats?.plans?.free || 0} Free Tier Accounts</div>
                                </div>
                            </div>

                            {/* Telemetry Visual Grid */}
                            <div className="charts-grid-container">
                                {/* SVG Donut: Tier Distribution */}
                                <div className="chart-card">
                                    <div className="chart-header">
                                        <h3>Subscription Distribution</h3>
                                        <span className="chart-badge">LIVE TIERS</span>
                                    </div>
                                    <div className="donut-chart-wrapper">
                                        <div className="donut-svg-container">
                                            <svg className="svg-donut" viewBox="0 0 42 42">
                                                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4.2" />
                                                
                                                <circle
                                                    className={`donut-segment ${hoveredSegment === 'free' ? 'active' : ''}`}
                                                    cx="21" cy="21" r="15.915" fill="transparent" stroke="#38bdf8"
                                                    strokeWidth={hoveredSegment === 'free' ? '5.6' : '4.2'}
                                                    strokeDasharray={`${freePct} ${100 - freePct}`} strokeDashoffset="0"
                                                    onMouseEnter={() => setHoveredSegment('free')}
                                                    onMouseLeave={() => setHoveredSegment(null)}
                                                />
                                                <circle
                                                    className={`donut-segment ${hoveredSegment === 'pro' ? 'active' : ''}`}
                                                    cx="21" cy="21" r="15.915" fill="transparent" stroke="#818cf8"
                                                    strokeWidth={hoveredSegment === 'pro' ? '5.6' : '4.2'}
                                                    strokeDasharray={`${proPct} ${100 - proPct}`} strokeDashoffset={`-${freePct}`}
                                                    onMouseEnter={() => setHoveredSegment('pro')}
                                                    onMouseLeave={() => setHoveredSegment(null)}
                                                />
                                                <circle
                                                    className={`donut-segment ${hoveredSegment === 'premium' ? 'active' : ''}`}
                                                    cx="21" cy="21" r="15.915" fill="transparent" stroke="#c084fc"
                                                    strokeWidth={hoveredSegment === 'premium' ? '5.6' : '4.2'}
                                                    strokeDasharray={`${premPct} ${100 - premPct}`} strokeDashoffset={`-${freePct + proPct}`}
                                                    onMouseEnter={() => setHoveredSegment('premium')}
                                                    onMouseLeave={() => setHoveredSegment(null)}
                                                />
                                            </svg>
                                            
                                            <div className="donut-center-info">
                                                {hoveredSegment === 'free' && (
                                                    <>
                                                        <span className="donut-center-label" style={{ color: '#38bdf8' }}>Free Tier</span>
                                                        <span className="donut-center-val">{freeCount} ({freePct}%)</span>
                                                    </>
                                                )}
                                                {hoveredSegment === 'pro' && (
                                                    <>
                                                        <span className="donut-center-label" style={{ color: '#818cf8' }}>Pro Tier</span>
                                                        <span className="donut-center-val">{proCount} ({proPct}%)</span>
                                                    </>
                                                )}
                                                {hoveredSegment === 'premium' && (
                                                    <>
                                                        <span className="donut-center-label" style={{ color: '#c084fc' }}>Premium</span>
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
                                                    <span className="dot" style={{ background: '#38bdf8' }}></span> Free Tier
                                                </span>
                                                <span className="legend-value">{freeCount} ({freePct}%)</span>
                                            </div>
                                            <div
                                                className={`legend-item ${hoveredSegment === 'pro' ? 'highlighted' : ''}`}
                                                onMouseEnter={() => setHoveredSegment('pro')}
                                                onMouseLeave={() => setHoveredSegment(null)}
                                            >
                                                <span className="legend-label">
                                                    <span className="dot" style={{ background: '#818cf8' }}></span> Pro Tier
                                                </span>
                                                <span className="legend-value">{proCount} ({proPct}%)</span>
                                            </div>
                                            <div
                                                className={`legend-item ${hoveredSegment === 'premium' ? 'highlighted' : ''}`}
                                                onMouseEnter={() => setHoveredSegment('premium')}
                                                onMouseLeave={() => setHoveredSegment(null)}
                                            >
                                                <span className="legend-label">
                                                    <span className="dot" style={{ background: '#c084fc' }}></span> Premium Tier
                                                </span>
                                                <span className="legend-value">{premCount} ({premPct}%)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Platform Output Volume */}
                                <div className="chart-card">
                                    <div className="chart-header">
                                        <h3>Pipeline Output Activity</h3>
                                        <span className="chart-badge">GENERATIONS</span>
                                    </div>
                                    <div className="bar-chart-wrapper">
                                        <div className="bar-group">
                                            <div className="bar-label-row">
                                                <span>Mock Interview Reports</span>
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

                                {/* Account Security Health */}
                                <div className="chart-card">
                                    <div className="chart-header">
                                        <h3>Account Access Health</h3>
                                        <span className="chart-badge">SECURITY RATIOS</span>
                                    </div>
                                    <div className="bar-chart-wrapper">
                                        <div className="bar-group">
                                            <div className="bar-label-row">
                                                <span>Active Accounts</span>
                                                <span>{activeCount} ({activePct}%)</span>
                                            </div>
                                            <div className="bar-track">
                                                <div className="bar-fill" style={{ width: `${activePct}%`, background: '#22c55e' }}></div>
                                            </div>
                                        </div>

                                        <div className="bar-group">
                                            <div className="bar-label-row">
                                                <span>Suspended Accounts</span>
                                                <span>{blockedCount} ({blockedPct}%)</span>
                                            </div>
                                            <div className="bar-track">
                                                <div className="bar-fill" style={{ width: `${blockedPct}%`, background: '#ef4444' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 7-Day Growth Timeline */}
                                <div className="chart-card">
                                    <div className="chart-header">
                                        <h3>7-Day Registration Growth</h3>
                                        <span className="chart-badge">RECENT ACTIVITY</span>
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
                                            <div className="empty-chart-notice">
                                                No registrations recorded in last 7 days.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* View 2: User Directory */}
                    {activeTab === 'table' && (
                        <div className="users-directory-section">
                            {/* Toolbar Filters */}
                            <div className="users-toolbar">
                                <div className="search-box">
                                    <input
                                        type="text"
                                        placeholder="Filter by Username or Email..."
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
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>

                                    <select value={blockedFilter} onChange={(e) => setBlockedFilter(e.target.value)}>
                                        <option value="">All Statuses</option>
                                        <option value="false">Active Only</option>
                                        <option value="true">Suspended Only</option>
                                    </select>

                                    {(search || planFilter || roleFilter || blockedFilter) && (
                                        <button
                                            type="button"
                                            className="reset-filters-btn"
                                            onClick={() => {
                                                setSearch('');
                                                setPlanFilter('');
                                                setRoleFilter('');
                                                setBlockedFilter('');
                                            }}
                                            title="Clear all active filters"
                                        >
                                            <RotateCcw size={13} /> Clear
                                        </button>
                                    )}
                                </div>

                                <div className="toolbar-counter">
                                    Total <strong>{pagination.total}</strong> accounts
                                </div>
                            </div>

                            {/* Users High-Density Data Table */}
                            <div className="users-table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Account Profile</th>
                                            <th>Security Role</th>
                                            <th>Subscription Tier</th>
                                            <th>Reports</th>
                                            <th>Resumes</th>
                                            <th>Cover Letters</th>
                                            <th>Bonus Credits</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr>
                                                <td colSpan="9" className="empty-table-cell">
                                                    Loading accounts directory...
                                                </td>
                                            </tr>
                                        ) : users.length === 0 ? (
                                            <tr>
                                                <td colSpan="9" className="empty-table-cell">
                                                    No user accounts matching the specified filters.
                                                </td>
                                            </tr>
                                        ) : (
                                            users.map((u) => (
                                                <tr key={u._id}>
                                                    <td>
                                                        <Link
                                                            to={`/admin-portal-dashboard-root/user-evaluation/${u._id}`}
                                                            className="user-cell"
                                                            title="Deep inspect user activity"
                                                        >
                                                            <div className="avatar-circle" style={['admin', 'super_admin'].includes(u.role) ? { background: 'linear-gradient(135deg, #ef4444, #f97316)' } : {}}>
                                                                {(u.username || "U")[0].toUpperCase()}
                                                            </div>
                                                            <div className="user-details">
                                                                <div className="user-name">{u.username}</div>
                                                                <div className="user-email">{u.email}</div>
                                                            </div>
                                                        </Link>
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="action-select"
                                                            value={u.role || 'user'}
                                                            onChange={(e) => requestRoleChange(u, e.target.value)}
                                                        >
                                                            <option value="user">User</option>
                                                            <option value="admin">Admin</option>
                                                            <option value="super_admin">Super Admin</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="action-select"
                                                            value={(u.plan || 'free').toLowerCase()}
                                                            onChange={(e) => requestPlanChange(u, e.target.value)}
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
                                                        <strong style={{ color: '#34d399' }}>{u.totalResumes || 0}</strong>
                                                    </td>
                                                    <td>
                                                        <strong style={{ color: '#c084fc' }}>{u.totalCoverLetters || 0}</strong>
                                                    </td>
                                                    <td>
                                                        <span style={{ color: u.customBonusCredits ? '#818cf8' : '#94a3b8', fontWeight: u.customBonusCredits ? 700 : 400 }}>
                                                            +{u.customBonusCredits || 0}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge-pill ${u.isBlocked ? 'blocked' : 'active'}`}>
                                                            {u.isBlocked ? 'SUSPENDED' : 'ACTIVE'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="table-row-actions">
                                                            <button
                                                                type="button"
                                                                className="row-action-btn evaluate-btn"
                                                                onClick={() => openEvaluationModal(u)}
                                                                title="Quick Feature Permissions Modal"
                                                            >
                                                                <Sliders size={13} />
                                                                <span>Features</span>
                                                            </button>

                                                            <Link
                                                                to={`/admin-portal-dashboard-root/user-evaluation/${u._id}`}
                                                                className="row-action-btn link-eval-btn"
                                                                title="Open Detailed Evaluation Page"
                                                            >
                                                                <ExternalLink size={13} />
                                                            </Link>

                                                            <button
                                                                type="button"
                                                                className={`row-action-btn ${u.isBlocked ? 'unblock-btn' : 'block-btn'}`}
                                                                onClick={() => requestToggleBlock(u)}
                                                                title={u.isBlocked ? "Restore user access" : "Suspend user access"}
                                                            >
                                                                {u.isBlocked ? <Unlock size={13} /> : <Lock size={13} />}
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="row-action-btn delete-btn"
                                                                onClick={() => requestDeleteUser(u)}
                                                                title="Purge user account"
                                                            >
                                                                <Trash2 size={13} />
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
                            <AdminPagination
                                page={pagination.page}
                                pages={pagination.pages}
                                total={pagination.total}
                                limit={pagination.limit || 20}
                                loading={loading}
                                onPageChange={fetchUsersList}
                            />
                        </div>
                    )}

                    {/* View 3: Feature Matrix */}
                    {activeTab === 'feature-matrix' && (
                        <AdminFeatureMatrixTab
                            users={users}
                            setUsers={setUsers}
                            pagination={pagination}
                            onPageChange={fetchUsersList}
                            loading={loading}
                            onRefresh={fetchUsersList}
                        />
                    )}

                    {/* View 4: Payments Ledger */}
                    {activeTab === 'payments' && <AdminPaymentsTab />}

                    {/* View 5: Subscriptions */}
                    {activeTab === 'subscriptions' && <AdminSubscriptionsTab />}

                    {/* View 6: Audit Trail */}
                    {activeTab === 'audit-logs' && <AdminAuditLogsTab />}

                    {/* View 7: Broadcast & Alerts */}
                    {activeTab === 'broadcast' && <AdminBroadcastTab />}

                    {/* View 8: Admin Management */}
                    {activeTab === 'admins' && (
                        <AdminManagementTab
                            stats={stats}
                            users={users}
                            onRefresh={handleRefreshAll}
                        />
                    )}

                    {/* View 9: Bonus Credits */}
                    {activeTab === 'credits' && (
                        <AdminCreditsTab onRefresh={handleRefreshAll} />
                    )}
                </main>
            </div>

            {/* Modal: Quick Feature Control */}
            {evalUser && (
                <div className="modal-overlay" onClick={() => setEvalUser(null)}>
                    <div className="modal-card evaluation-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-row">
                            <div className="modal-user-title">
                                <div className="avatar-circle">
                                    {(evalUser.username || "U")[0].toUpperCase()}
                                </div>
                                <div>
                                    <h3>Feature Access Controls</h3>
                                    <span className="user-sub">{evalUser.email}</span>
                                </div>
                            </div>
                            <button className="modal-close-btn" onClick={() => setEvalUser(null)}>✕</button>
                        </div>

                        {evalMsg.text && (
                            <div className={`modal-msg-banner ${evalMsg.type}`}>
                                {evalMsg.text}
                            </div>
                        )}

                        <form onSubmit={handleSaveFeatureAccess}>
                            <div className="feature-toggle-list">
                                <div className="feature-item-row">
                                    <div>
                                        <div className="feature-name">AI Assistant & Section Writer</div>
                                        <div className="feature-desc">AI suggestions and section optimization</div>
                                    </div>
                                    <button
                                        type="button"
                                        className={`feature-btn ${evalFeatures.aiAssistant ? 'blocked' : 'allowed'}`}
                                        onClick={() => setEvalFeatures(prev => ({ ...prev, aiAssistant: !prev.aiAssistant }))}
                                    >
                                        {evalFeatures.aiAssistant ? 'BLOCKED' : 'ENABLED'}
                                    </button>
                                </div>

                                <div className="feature-item-row">
                                    <div>
                                        <div className="feature-name">Mock Interview & Reports</div>
                                        <div className="feature-desc">AI interview questions and score evaluation</div>
                                    </div>
                                    <button
                                        type="button"
                                        className={`feature-btn ${evalFeatures.interviewReports ? 'blocked' : 'allowed'}`}
                                        onClick={() => setEvalFeatures(prev => ({ ...prev, interviewReports: !prev.interviewReports }))}
                                    >
                                        {evalFeatures.interviewReports ? 'BLOCKED' : 'ENABLED'}
                                    </button>
                                </div>

                                <div className="feature-item-row">
                                    <div>
                                        <div className="feature-name">Cover Letter & CV Generation</div>
                                        <div className="feature-desc">AI tailored cover letter generator</div>
                                    </div>
                                    <button
                                        type="button"
                                        className={`feature-btn ${evalFeatures.coverLetterGeneration ? 'blocked' : 'allowed'}`}
                                        onClick={() => setEvalFeatures(prev => ({ ...prev, coverLetterGeneration: !prev.coverLetterGeneration }))}
                                    >
                                        {evalFeatures.coverLetterGeneration ? 'BLOCKED' : 'ENABLED'}
                                    </button>
                                </div>

                                <div className="feature-item-row">
                                    <div>
                                        <div className="feature-name">Resume Builder & PDF</div>
                                        <div className="feature-desc">Full resume generation and export</div>
                                    </div>
                                    <button
                                        type="button"
                                        className={`feature-btn ${evalFeatures.resumeGeneration ? 'blocked' : 'allowed'}`}
                                        onClick={() => setEvalFeatures(prev => ({ ...prev, resumeGeneration: !prev.resumeGeneration }))}
                                    >
                                        {evalFeatures.resumeGeneration ? 'BLOCKED' : 'ENABLED'}
                                    </button>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setEvalUser(null)}>
                                    Close
                                </button>
                                <button type="submit" className="btn-submit" disabled={evalSubmitting}>
                                    {evalSubmitting ? 'Saving...' : 'Save Permissions'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Quick Create Admin */}
            {isAdminModalOpen && (
                <div className="modal-overlay" onClick={() => setIsAdminModalOpen(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-row">
                            <h3>Register Platform Administrator</h3>
                            <button className="modal-close-btn" onClick={() => setIsAdminModalOpen(false)}>✕</button>
                        </div>

                        {adminMsg.text && (
                            <div className={`modal-msg-banner ${adminMsg.type}`}>
                                {adminMsg.text}
                            </div>
                        )}

                        <form onSubmit={handleCreateAdminSubmit}>
                            <div className="form-group">
                                <label>Admin Username</label>
                                <input
                                    type="text"
                                    placeholder="e.g. system_admin"
                                    value={newAdminForm.username}
                                    onChange={(e) => setNewAdminForm(prev => ({ ...prev, username: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    placeholder="e.g. admin@kivi.ai"
                                    value={newAdminForm.email}
                                    onChange={(e) => setNewAdminForm(prev => ({ ...prev, email: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Temporary Password</label>
                                <input
                                    type="password"
                                    placeholder="••••••••••••"
                                    value={newAdminForm.password}
                                    onChange={(e) => setNewAdminForm(prev => ({ ...prev, password: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Security Role</label>
                                <select
                                    className="action-select"
                                    style={{ width: '100%' }}
                                    value={newAdminForm.role}
                                    onChange={(e) => setNewAdminForm(prev => ({ ...prev, role: e.target.value }))}
                                >
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setIsAdminModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit" disabled={adminSubmitting}>
                                    {adminSubmitting ? 'Creating...' : 'Create Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Quick Grant Credits */}
            {isCreditModalOpen && (
                <div className="modal-overlay" onClick={() => setIsCreditModalOpen(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-row">
                            <h3>Grant Bonus Credits</h3>
                            <button className="modal-close-btn" onClick={() => setIsCreditModalOpen(false)}>✕</button>
                        </div>

                        {creditMsg.text && (
                            <div className={`modal-msg-banner ${creditMsg.type}`}>
                                {creditMsg.text}
                            </div>
                        )}

                        <form onSubmit={handleGrantCreditsSubmit}>
                            <div className="form-group">
                                <label>User Email or Database User ID</label>
                                <input
                                    type="text"
                                    placeholder="e.g. candidate@gmail.com or 64b8f..."
                                    value={creditIdentifier}
                                    onChange={(e) => setCreditIdentifier(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Credits to Allocate</label>
                                <input
                                    type="number"
                                    min="-500"
                                    max="1000"
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(Number(e.target.value))}
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setIsCreditModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit" disabled={creditSubmitting}>
                                    {creditSubmitting ? 'Applying...' : 'Apply Credits'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Quick Send Broadcast */}
            {isMsgModalOpen && (
                <div className="modal-overlay" onClick={() => setIsMsgModalOpen(false)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-row">
                            <h3>Send Platform Notification</h3>
                            <button className="modal-close-btn" onClick={() => setIsMsgModalOpen(false)}>✕</button>
                        </div>

                        {msgResult.text && (
                            <div className={`modal-msg-banner ${msgResult.type}`}>
                                {msgResult.text}
                            </div>
                        )}

                        <form onSubmit={handleSendAdminMessageSubmit}>
                            <div className="form-group">
                                <label>Audience Scope</label>
                                <select
                                    value={msgForm.targetType}
                                    onChange={(e) => setMsgForm({ ...msgForm, targetType: e.target.value, targetValue: '' })}
                                    className="action-select"
                                    style={{ width: '100%' }}
                                >
                                    <option value="all">All Platform Users</option>
                                    <option value="free">Free Plan Users</option>
                                    <option value="pro">Pro Plan Users</option>
                                    <option value="premium">Premium Plan Users</option>
                                    <option value="user">Direct Individual User</option>
                                </select>
                            </div>

                            {msgForm.targetType === 'user' && (
                                <div className="form-group">
                                    <label>User Email or User ID</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. user@gmail.com"
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
                                    placeholder="e.g. Scheduled System Upgrade"
                                    value={msgForm.title}
                                    onChange={(e) => setMsgForm({ ...msgForm, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Message Content</label>
                                <textarea
                                    rows={4}
                                    placeholder="Write your announcement..."
                                    value={msgForm.message}
                                    onChange={(e) => setMsgForm({ ...msgForm, message: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={() => setIsMsgModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit" disabled={msgSubmitting}>
                                    {msgSubmitting ? 'Dispatching...' : 'Dispatch Alert'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Sensitive Action Confirmation Modal */}
            <ConfirmModal
                {...confirmModal}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
