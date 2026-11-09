import React, { useState } from 'react';
import { createAdminAccount, updateUserRole } from '../services/admin.api';
import { useAuth } from '../../Auth/hooks/useAuth';
import { 
    UserPlus, 
    Shield, 
    ShieldCheck, 
    KeyRound, 
    CheckCircle, 
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
    Info
} from 'lucide-react';
import { ROLE_METADATA, ROLE_PERMISSIONS, PERMISSIONS } from '../utils/rbac';

export const AdminManagementTab = ({ stats, users, onRefresh }) => {
    const { user: currentUser } = useAuth();
    const isSuperAdmin = currentUser?.role === 'super_admin';

    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        role: 'user_admin'
    });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState({ type: '', text: '' });
    const [updatingUserId, setUpdatingUserId] = useState(null);
    const [showMatrix, setShowMatrix] = useState(false);

    // Filter admins from users list
    const adminRolesList = ['super_admin', 'admin', 'user_admin', 'billing_admin', 'support_admin', 'ops_admin', 'analytics_admin'];
    const adminAccounts = users.filter(u => adminRolesList.includes(u.role));

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

    const roleCards = [
        { id: 'super_admin', label: 'Super Admin', desc: 'Unrestricted platform governance & admin management', icon: ShieldCheck, superOnly: true },
        { id: 'admin', label: 'General Admin', desc: 'Full operational & platform administration tools', icon: Shield },
        { id: 'user_admin', label: 'User Admin', desc: 'User accounts, directory, and suspensions', icon: Users },
        { id: 'billing_admin', label: 'Billing Admin', desc: 'Payments, subscriptions, tax invoices & refunds', icon: CreditCard },
        { id: 'support_admin', label: 'Support Admin', desc: 'Customer tickets, support replies & assignment', icon: LifeBuoy },
        { id: 'ops_admin', label: 'Operations Admin', desc: 'BullMQ background jobs & audit log monitoring', icon: Cpu },
        { id: 'analytics_admin', label: 'Analytics Admin', desc: 'Usage metrics, reporting & data exports', icon: BarChart3 }
    ];

    return (
        <div className="admin-management-section">
            <div className="management-grid-layout">
                {/* Admin Creation Form */}
                <div className="admin-form-card">
                    <div className="section-title-row">
                        <div className="title-with-icon">
                            <UserPlus size={20} className="icon-accent" />
                            <div>
                                <h2>Register New Administrator</h2>
                                <span className="section-sub">Add credentials with granular role-based permissions</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowMatrix(prev => !prev)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 border border-zinc-700 transition"
                        >
                            <Info size={14} />
                            <span>{showMatrix ? 'Hide Matrix' : 'Permissions Matrix'}</span>
                        </button>
                    </div>

                    {result.text && (
                        <div className={`broadcast-result-banner ${result.type}`}>
                            {result.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            <span>{result.text}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="admin-form">
                        <div className="form-item">
                            <label className="field-label">Admin Username</label>
                            <input
                                type="text"
                                className="console-input"
                                placeholder="e.g. support_lead"
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-item">
                            <label className="field-label">Official Email Address</label>
                            <input
                                type="email"
                                className="console-input"
                                placeholder="e.g. staff@kivi.ai"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-item">
                            <label className="field-label">Temporary Password</label>
                            <input
                                type="password"
                                className="console-input"
                                placeholder="••••••••••••"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-item">
                            <label className="field-label">Granular RBAC Security Role</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
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
                                            className={`p-3 text-left rounded-xl border transition flex flex-col justify-between ${
                                                isSelected
                                                    ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                                    : isDisabled
                                                    ? 'opacity-40 bg-zinc-900 border-zinc-800 cursor-not-allowed text-zinc-500'
                                                    : 'bg-zinc-850 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between w-full mb-1">
                                                <span className="font-semibold text-xs flex items-center gap-1.5">
                                                    <Icon size={14} className={isSelected ? 'text-indigo-400' : 'text-zinc-400'} />
                                                    {rc.label}
                                                </span>
                                                {rc.superOnly && (
                                                    <span className="text-[10px] text-rose-400 font-mono bg-rose-500/10 px-1.5 py-0.5 rounded">
                                                        Super Only
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-zinc-400 leading-tight">
                                                {rc.desc}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="form-actions-row">
                            <button
                                type="submit"
                                className="console-submit-btn"
                                disabled={submitting}
                            >
                                <KeyRound size={15} />
                                <span>{submitting ? 'Creating Administrator...' : 'Create Administrator'}</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* Current Admins List & Direct Role Management */}
                <div className="current-admins-card">
                    <div className="section-title-row">
                        <div className="title-with-icon">
                            <Users size={18} className="icon-accent" />
                            <div>
                                <h3>Active Platform Administrators</h3>
                                <span className="section-sub">Total: {adminAccounts.length} Verified Accounts</span>
                            </div>
                        </div>
                    </div>

                    <div className="admins-list">
                        {adminAccounts.length === 0 ? (
                            <div className="empty-state-card">
                                <span>No secondary admins found in current view.</span>
                            </div>
                        ) : (
                            adminAccounts.map((adm) => {
                                const meta = ROLE_METADATA[adm.role] || { label: adm.role, badgeClass: 'role-admin' };
                                const isTargetSuper = adm.role === 'super_admin';
                                const canEditThisAdmin = isSuperAdmin || (!isTargetSuper && adm._id !== currentUser?._id);

                                return (
                                    <div key={adm._id} className="admin-account-row flex items-center justify-between p-3 border-b border-zinc-800/80">
                                        <div className="flex items-center gap-3">
                                            <div className="admin-avatar">
                                                {(adm.username || 'A')[0].toUpperCase()}
                                            </div>
                                            <div className="admin-meta">
                                                <div className="flex items-center gap-2">
                                                    <span className="admin-username font-semibold text-sm text-zinc-200">{adm.username}</span>
                                                    {adm._id === currentUser?._id && (
                                                        <span className="text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">You</span>
                                                    )}
                                                </div>
                                                <span className="admin-email text-xs text-zinc-500">{adm.email}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Role Selector Dropdown */}
                                            {canEditThisAdmin ? (
                                                <select
                                                    value={adm.role}
                                                    disabled={updatingUserId === adm._id}
                                                    onChange={(e) => handleRoleChange(adm._id, adm.role, e.target.value)}
                                                    className="px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-200 focus:outline-none focus:border-indigo-500"
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
                                                <span className={`badge-pill ${meta.badgeClass}`}>
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

            {/* Optional Role & Permission Reference Matrix Drawer / Panel */}
            {showMatrix && (
                <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-fade-in">
                    <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
                        <div className="flex items-center gap-2.5">
                            <Sliders size={18} className="text-indigo-400" />
                            <h3 className="text-sm font-semibold text-white">Platform RBAC Permission Matrix</h3>
                        </div>
                        <button onClick={() => setShowMatrix(false)} className="text-zinc-400 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-800 text-zinc-400 bg-zinc-850">
                                    <th className="py-2.5 px-3">Permission Group</th>
                                    <th className="py-2.5 px-3 text-center">Super Admin</th>
                                    <th className="py-2.5 px-3 text-center">General Admin</th>
                                    <th className="py-2.5 px-3 text-center">User Admin</th>
                                    <th className="py-2.5 px-3 text-center">Billing Admin</th>
                                    <th className="py-2.5 px-3 text-center">Support Admin</th>
                                    <th className="py-2.5 px-3 text-center">Ops Admin</th>
                                    <th className="py-2.5 px-3 text-center">Analytics Admin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                                {Object.values(PERMISSIONS).map(perm => (
                                    <tr key={perm} className="hover:bg-zinc-800/20">
                                        <td className="py-2 px-3 text-zinc-300 font-sans">{perm}</td>
                                        <td className="py-2 px-3 text-center text-emerald-400">✓</td>
                                        <td className="py-2 px-3 text-center">
                                            {ROLE_PERMISSIONS.admin.includes(perm) ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">—</span>}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {ROLE_PERMISSIONS.user_admin.includes(perm) ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">—</span>}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {ROLE_PERMISSIONS.billing_admin.includes(perm) ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">—</span>}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {ROLE_PERMISSIONS.support_admin.includes(perm) ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">—</span>}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {ROLE_PERMISSIONS.ops_admin.includes(perm) ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">—</span>}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            {ROLE_PERMISSIONS.analytics_admin.includes(perm) ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-600">—</span>}
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
