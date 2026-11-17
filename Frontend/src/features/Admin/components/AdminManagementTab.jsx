import React, { useState, useMemo } from 'react';
import { createAdminAccount, updateUserRole } from '../services/admin.api';
import { useAuth } from '../../Auth/hooks/useAuth';
import { 
    UserPlus, 
    Shield, 
    ShieldCheck, 
    KeyRound, 
    CheckCircle2, 
    AlertCircle, 
    Users, 
    Lock,
    Sliders,
    Layers,
    CreditCard,
    LifeBuoy,
    Cpu,
    BarChart3,
    Check,
    X,
    Info,
    Search,
    Copy,
    CheckCheck,
    Eye,
    EyeOff,
    RefreshCw,
    UserCheck,
    SlidersHorizontal,
    ChevronDown,
    LockKeyhole
} from 'lucide-react';
import { ROLE_METADATA, ROLE_PERMISSIONS, PERMISSIONS } from '../utils/rbac';

export const AdminManagementTab = ({ stats, users = [], onRefresh }) => {
    const { user: currentUser } = useAuth();
    const isSuperAdmin = currentUser?.role === 'super_admin';

    // Form state
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        role: 'user_admin'
    });
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [result, setResult] = useState({ type: '', text: '' });
    const [updatingUserId, setUpdatingUserId] = useState(null);
    const [copiedEmailId, setCopiedEmailId] = useState(null);

    // Matrix Drawer & Search states
    const [showMatrix, setShowMatrix] = useState(false);
    const [matrixSearch, setMatrixSearch] = useState('');
    const [adminSearch, setAdminSearch] = useState('');
    const [adminRoleFilter, setAdminRoleFilter] = useState('ALL');

    // Filter admins from users list
    const adminRolesList = useMemo(() => [
        'super_admin',
        'admin',
        'user_admin',
        'billing_admin',
        'support_admin',
        'ops_admin',
        'analytics_admin'
    ], []);

    const allAdminAccounts = useMemo(() => {
        return (users || []).filter(u => adminRolesList.includes(u.role));
    }, [users, adminRolesList]);

    // Filtered admin accounts
    const filteredAdminAccounts = useMemo(() => {
        return allAdminAccounts.filter(adm => {
            const matchesRole = adminRoleFilter === 'ALL' || adm.role === adminRoleFilter;
            const searchLower = adminSearch.toLowerCase().trim();
            const matchesSearch = !searchLower || 
                (adm.username && adm.username.toLowerCase().includes(searchLower)) ||
                (adm.email && adm.email.toLowerCase().includes(searchLower));
            return matchesRole && matchesSearch;
        });
    }, [allAdminAccounts, adminRoleFilter, adminSearch]);

    // Statistics counts
    const superAdminCount = useMemo(() => {
        return allAdminAccounts.filter(u => u.role === 'super_admin').length;
    }, [allAdminAccounts]);

    const functionalAdminCount = useMemo(() => {
        return allAdminAccounts.filter(u => u.role !== 'super_admin').length;
    }, [allAdminAccounts]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setResult({ type: '', text: '' });

        try {
            const res = await createAdminAccount(form);
            setResult({ type: 'success', text: res.message || 'Administrator account registered successfully!' });
            setForm({ username: '', email: '', password: '', role: 'user_admin' });
            if (onRefresh) onRefresh();
        } catch (err) {
            setResult({ type: 'error', text: err?.response?.data?.message || 'Failed to create administrator account.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRoleChange = async (userId, targetUserRole, newRole) => {
        if (!newRole || newRole === targetUserRole) return;

        if (newRole === 'super_admin' && !isSuperAdmin) {
            setResult({ type: 'error', text: 'Privilege escalation prevented: Only Super Admins can assign the Super Admin role.' });
            return;
        }

        try {
            setUpdatingUserId(userId);
            setResult({ type: '', text: '' });
            const res = await updateUserRole(userId, newRole);
            setResult({ type: 'success', text: res.message || `Updated role to ${newRole}.` });
            if (onRefresh) onRefresh();
        } catch (err) {
            setResult({ type: 'error', text: err?.response?.data?.message || 'Failed to update administrative role.' });
        } finally {
            setUpdatingUserId(null);
        }
    };

    const handleCopyEmail = (email, id) => {
        if (!email) return;
        navigator.clipboard.writeText(email);
        setCopiedEmailId(id);
        setTimeout(() => setCopiedEmailId(null), 1800);
    };

    const roleCards = [
        { 
            id: 'super_admin', 
            label: 'Super Admin', 
            tag: 'Full Governance',
            desc: 'Unrestricted platform governance & administrative control', 
            icon: ShieldCheck, 
            superOnly: true,
            themeClass: 'role-super'
        },
        { 
            id: 'admin', 
            label: 'General Admin', 
            tag: 'Operations',
            desc: 'General operational & platform administration tools', 
            icon: Shield,
            themeClass: 'role-admin'
        },
        { 
            id: 'user_admin', 
            label: 'User Admin', 
            tag: 'Directory',
            desc: 'Candidate directory, profile updates & suspensions', 
            icon: Users,
            themeClass: 'role-user'
        },
        { 
            id: 'billing_admin', 
            label: 'Billing Admin', 
            tag: 'Finances',
            desc: 'Payments, subscriptions, tax invoices & refunds', 
            icon: CreditCard,
            themeClass: 'role-billing'
        },
        { 
            id: 'support_admin', 
            label: 'Support Admin', 
            tag: 'Helpdesk',
            desc: 'Customer support tickets, triage & replies', 
            icon: LifeBuoy,
            themeClass: 'role-support'
        },
        { 
            id: 'ops_admin', 
            label: 'Operations Admin', 
            tag: 'Infrastructure',
            desc: 'Background jobs, worker monitoring & audit trail', 
            icon: Cpu,
            themeClass: 'role-ops'
        },
        { 
            id: 'analytics_admin', 
            label: 'Analytics Admin', 
            tag: 'Telemetry',
            desc: 'Metrics reports, usage trends & data exports', 
            icon: BarChart3,
            themeClass: 'role-analytics'
        }
    ];

    // Filter permissions for matrix search
    const filteredPermissions = useMemo(() => {
        const all = Object.values(PERMISSIONS);
        if (!matrixSearch.trim()) return all;
        const q = matrixSearch.toLowerCase().trim();
        return all.filter(p => p.toLowerCase().includes(q));
    }, [matrixSearch]);

    return (
        <div className="rbac-console-container">
            {/* ── 1. Page Header with Title, Telemetry Pill & Actions ─────────────── */}
            <div className="rbac-header">
                <div className="header-title-block">
                    <div className="title-row">
                        <h2>Administrator Directory & RBAC Governance</h2>
                        <span className="rbac-badge">
                            <span className="dot"></span>
                            RBAC Policy Active
                        </span>
                    </div>
                    <p className="header-subtitle">
                        Provision privileged credentials, enforce strict role boundaries, and inspect platform permissions.
                    </p>
                </div>

                <div className="header-actions">
                    <button
                        type="button"
                        onClick={() => setShowMatrix(prev => !prev)}
                        className={`matrix-toggle-btn ${showMatrix ? 'active' : ''}`}
                        title="Toggle full platform permissions matrix"
                    >
                        <Sliders size={14} />
                        <span>{showMatrix ? 'Hide Matrix' : 'Permissions Matrix'}</span>
                        <span className="pill-counter">{Object.values(PERMISSIONS).length} Rules</span>
                    </button>

                    {onRefresh && (
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="refresh-btn"
                            title="Refresh Administrator Directory"
                        >
                            <RefreshCw size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── 2. Top Stats Overview Strip ────────────────────────────────────── */}
            <div className="rbac-stats-grid">
                <div className="rbac-stat-card">
                    <div className="stat-content">
                        <span className="stat-label">Total Administrators</span>
                        <span className="stat-val">{allAdminAccounts.length}</span>
                        <span className="stat-sub">Active staff accounts</span>
                    </div>
                    <div className="stat-icon-box cyan">
                        <Users size={18} />
                    </div>
                </div>

                <div className="rbac-stat-card">
                    <div className="stat-content">
                        <span className="stat-label">Super Administrators</span>
                        <span className="stat-val">{superAdminCount}</span>
                        <span className="stat-sub">Full system governance</span>
                    </div>
                    <div className="stat-icon-box rose">
                        <ShieldCheck size={18} />
                    </div>
                </div>

                <div className="rbac-stat-card">
                    <div className="stat-content">
                        <span className="stat-label">Functional Admins</span>
                        <span className="stat-val">{functionalAdminCount}</span>
                        <span className="stat-sub">Granular scoped roles</span>
                    </div>
                    <div className="stat-icon-box indigo">
                        <Layers size={18} />
                    </div>
                </div>

                <div className="rbac-stat-card">
                    <div className="stat-content">
                        <span className="stat-label">Escalation Policy</span>
                        <span className="stat-val" style={{ fontSize: '1.05rem', marginTop: '0.2rem' }}>Strict Isolation</span>
                        <span className="stat-sub">Escalations prevented</span>
                    </div>
                    <div className="stat-icon-box emerald">
                        <KeyRound size={18} />
                    </div>
                </div>
            </div>

            {/* ── Feedback Notification Banner ───────────────────────────────────── */}
            {result.text && (
                <div className={`rbac-feedback-banner ${result.type}`}>
                    <div className="banner-body">
                        {result.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span>{result.text}</span>
                    </div>
                    <button 
                        type="button" 
                        onClick={() => setResult({ type: '', text: '' })} 
                        className="dismiss-btn"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* ── 3. Main Split Grid (Create Admin Form + Active Directory) ──────── */}
            <div className="rbac-main-grid">
                {/* ── Left Column: Admin Registration Form ──────────────────────── */}
                <div className="rbac-card">
                    <div className="card-header-row">
                        <div className="header-meta">
                            <div className="header-icon-box">
                                <UserPlus size={18} />
                            </div>
                            <div className="header-text">
                                <h3>Register New Administrator</h3>
                                <p>Assign dedicated staff credentials with predetermined RBAC privilege boundaries.</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="form-content">
                        <div className="form-field-group">
                            <div className="field-label-row">
                                <label>Admin Username</label>
                                <span className="field-hint">Unique identifier</span>
                            </div>
                            <div className="input-wrapper">
                                <span className="input-icon">@</span>
                                <input
                                    type="text"
                                    placeholder="e.g. ops_director"
                                    value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                                    required
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        <div className="form-field-group">
                            <div className="field-label-row">
                                <label>Official Email Address</label>
                                <span className="field-hint">For authentication & alerts</span>
                            </div>
                            <div className="input-wrapper">
                                <span className="input-icon">✉</span>
                                <input
                                    type="email"
                                    placeholder="e.g. staff.ops@kivi.ai"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
                                    autoComplete="off"
                                />
                            </div>
                        </div>

                        <div className="form-field-group">
                            <div className="field-label-row">
                                <label>Temporary Password</label>
                                <span className="field-hint">Must rotate on first login</span>
                            </div>
                            <div className="input-wrapper">
                                <Lock size={14} className="input-icon" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••••••"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    required
                                    className="has-toggle"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(p => !p)}
                                    className="toggle-pwd-btn"
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* ── Granular Role Selection Grid ────────────────────────── */}
                        <div className="role-selection-block">
                            <div className="field-label-row mb-1">
                                <label>Granular RBAC Security Role</label>
                                <span className="field-hint">Select exact operational policy</span>
                            </div>

                            <div className="role-grid-container">
                                {roleCards.map(rc => {
                                    const Icon = rc.icon;
                                    const isSelected = form.role === rc.id;
                                    const isDisabled = rc.superOnly && !isSuperAdmin;

                                    return (
                                        <button
                                            key={rc.id}
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() => setForm({ ...form, role: rc.id })}
                                            className={`role-choice-card ${rc.themeClass} ${isSelected ? 'selected' : ''}`}
                                            title={isDisabled ? 'Only Super Administrators can assign this tier' : rc.desc}
                                        >
                                            <div className="card-top">
                                                <div className="role-title-group">
                                                    <Icon size={14} className="role-icon" />
                                                    <span className="role-label">{rc.label}</span>
                                                </div>

                                                {isDisabled ? (
                                                    <span className="role-indicator-badge super flex items-center gap-1">
                                                        <LockKeyhole size={10} />
                                                        Super Only
                                                    </span>
                                                ) : isSelected ? (
                                                    <span className="role-indicator-badge selected-dot"></span>
                                                ) : (
                                                    <span className="text-[10px] text-zinc-500 font-mono">{rc.tag}</span>
                                                )}
                                            </div>

                                            <p className="role-desc">
                                                {rc.desc}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Submit Button ─────────────────────────────────────── */}
                        <div className="submit-row">
                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={submitting}
                            >
                                <KeyRound size={15} />
                                <span>{submitting ? 'Registering Account...' : 'Create Administrator'}</span>
                            </button>
                            <span className="submit-disclaimer">
                                Privileges take effect immediately upon account creation.
                            </span>
                        </div>
                    </form>
                </div>

                {/* ── Right Column: Active Administrators Directory ────────────── */}
                <div className="rbac-card admins-directory-card">
                    <div className="card-header-row">
                        <div className="header-meta">
                            <div className="header-icon-box cyan">
                                <Users size={18} />
                            </div>
                            <div className="header-text">
                                <h3>Active Platform Administrators</h3>
                                <p>{allAdminAccounts.length} Verified Staff Credentials with administrative access.</p>
                            </div>
                        </div>
                    </div>

                    {/* Search and Role Filter Bar */}
                    <div className="search-and-filter-bar">
                        <div className="search-box">
                            <Search size={14} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Filter by username or email..."
                                value={adminSearch}
                                onChange={(e) => setAdminSearch(e.target.value)}
                            />
                        </div>

                        <select
                            value={adminRoleFilter}
                            onChange={(e) => setAdminRoleFilter(e.target.value)}
                            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                            <option value="ALL">All Roles ({allAdminAccounts.length})</option>
                            <option value="super_admin">Super Admins ({superAdminCount})</option>
                            <option value="admin">General Admins</option>
                            <option value="user_admin">User Admins</option>
                            <option value="billing_admin">Billing Admins</option>
                            <option value="support_admin">Support Admins</option>
                            <option value="ops_admin">Ops Admins</option>
                            <option value="analytics_admin">Analytics Admins</option>
                        </select>
                    </div>

                    {/* Admins Scrollable List */}
                    <div className="admins-scroll-list">
                        {filteredAdminAccounts.length === 0 ? (
                            <div className="empty-admins-box">
                                <Users size={24} className="opacity-40" />
                                <span>No administrators match your current filter criteria.</span>
                            </div>
                        ) : (
                            filteredAdminAccounts.map((adm) => {
                                const meta = ROLE_METADATA[adm.role] || { label: adm.role, badgeClass: 'role-admin' };
                                const isTargetSuper = adm.role === 'super_admin';
                                const isSelf = adm._id === currentUser?._id;
                                const canEditThisAdmin = isSuperAdmin || (!isTargetSuper && !isSelf);

                                return (
                                    <div key={adm._id} className="admin-account-item">
                                        <div className="admin-identity-group">
                                            <div className={`admin-avatar-box ${adm.role}`}>
                                                {(adm.username || 'A')[0].toUpperCase()}
                                            </div>

                                            <div className="admin-text-details">
                                                <div className="name-row">
                                                    <span className="username">{adm.username}</span>
                                                    {isSelf && <span className="self-pill">You</span>}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="email">{adm.email}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyEmail(adm.email, adm._id)}
                                                        className="text-slate-500 hover:text-slate-300 transition"
                                                        title="Copy email address"
                                                    >
                                                        {copiedEmailId === adm._id ? (
                                                            <CheckCheck size={11} className="text-emerald-400" />
                                                        ) : (
                                                            <Copy size={11} />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="admin-role-action">
                                            {canEditThisAdmin ? (
                                                <select
                                                    value={adm.role}
                                                    disabled={updatingUserId === adm._id}
                                                    onChange={(e) => handleRoleChange(adm._id, adm.role, e.target.value)}
                                                    className="role-select"
                                                >
                                                    {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                                                    <option value="admin">Administrator</option>
                                                    <option value="user_admin">User Admin</option>
                                                    <option value="billing_admin">Billing Admin</option>
                                                    <option value="support_admin">Support Admin</option>
                                                    <option value="ops_admin">Operations Admin</option>
                                                    <option value="analytics_admin">Analytics Admin</option>
                                                    <option value="user">Demote to User</option>
                                                </select>
                                            ) : (
                                                <span className={`read-only-badge ${meta.badgeClass}`}>
                                                    {meta.label.toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* ── 4. Permissions Matrix Card / Drawer ────────────────────────────── */}
            {showMatrix && (
                <div className="rbac-matrix-card">
                    <div className="matrix-header">
                        <div className="matrix-title-group">
                            <Sliders size={18} className="text-indigo-400" />
                            <h3>Platform RBAC Permission Matrix</h3>
                            <span className="matrix-pill">
                                {Object.values(PERMISSIONS).length} Rules Across 7 Roles
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative flex items-center">
                                <Search size={12} className="absolute left-2.5 text-slate-500 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Filter permissions..."
                                    value={matrixSearch}
                                    onChange={(e) => setMatrixSearch(e.target.value)}
                                    className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg pl-7 pr-2.5 py-1 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <button 
                                type="button"
                                onClick={() => setShowMatrix(false)} 
                                className="close-matrix-btn"
                                title="Close Matrix"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="matrix-table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Permission Identifier</th>
                                    <th className="center">Super Admin</th>
                                    <th className="center">General Admin</th>
                                    <th className="center">User Admin</th>
                                    <th className="center">Billing Admin</th>
                                    <th className="center">Support Admin</th>
                                    <th className="center">Ops Admin</th>
                                    <th className="center">Analytics Admin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPermissions.map(perm => (
                                    <tr key={perm}>
                                        <td className="perm-key">{perm}</td>
                                        <td className="center">
                                            <span className="check-pill">✓</span>
                                        </td>
                                        <td className="center">
                                            {ROLE_PERMISSIONS.admin.includes(perm) ? (
                                                <span className="check-pill">✓</span>
                                            ) : (
                                                <span className="dash-pill">—</span>
                                            )}
                                        </td>
                                        <td className="center">
                                            {ROLE_PERMISSIONS.user_admin.includes(perm) ? (
                                                <span className="check-pill">✓</span>
                                            ) : (
                                                <span className="dash-pill">—</span>
                                            )}
                                        </td>
                                        <td className="center">
                                            {ROLE_PERMISSIONS.billing_admin.includes(perm) ? (
                                                <span className="check-pill">✓</span>
                                            ) : (
                                                <span className="dash-pill">—</span>
                                            )}
                                        </td>
                                        <td className="center">
                                            {ROLE_PERMISSIONS.support_admin.includes(perm) ? (
                                                <span className="check-pill">✓</span>
                                            ) : (
                                                <span className="dash-pill">—</span>
                                            )}
                                        </td>
                                        <td className="center">
                                            {ROLE_PERMISSIONS.ops_admin.includes(perm) ? (
                                                <span className="check-pill">✓</span>
                                            ) : (
                                                <span className="dash-pill">—</span>
                                            )}
                                        </td>
                                        <td className="center">
                                            {ROLE_PERMISSIONS.analytics_admin.includes(perm) ? (
                                                <span className="check-pill">✓</span>
                                            ) : (
                                                <span className="dash-pill">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminManagementTab;
