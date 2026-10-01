import React, { useState } from 'react';
import { createAdminAccount } from '../services/admin.api';
import { UserPlus, Shield, ShieldCheck, KeyRound, CheckCircle, AlertCircle, Users } from 'lucide-react';

export const AdminManagementTab = ({ stats, users, onRefresh }) => {
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        role: 'admin'
    });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState({ type: '', text: '' });

    // Filter admins from users list
    const adminAccounts = users.filter(u => ['admin', 'super_admin'].includes(u.role));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setResult({ type: '', text: '' });

        try {
            const res = await createAdminAccount(form);
            setResult({ type: 'success', text: res.message || 'Administrator account registered successfully!' });
            setForm({ username: '', email: '', password: '', role: 'admin' });
            if (onRefresh) onRefresh();
        } catch (err) {
            setResult({ type: 'error', text: err?.response?.data?.message || 'Failed to create administrator account.' });
        } finally {
            setSubmitting(false);
        }
    };

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
                                <span className="section-sub">Add credentials with privileged system access</span>
                            </div>
                        </div>
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
                                placeholder="e.g. devops_lead"
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
                                placeholder="e.g. admin@kivi.ai"
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
                            <label className="field-label">Security Role Tier</label>
                            <div className="role-selector-grid">
                                <button
                                    type="button"
                                    className={`role-option-card ${form.role === 'admin' ? 'selected' : ''}`}
                                    onClick={() => setForm({ ...form, role: 'admin' })}
                                >
                                    <div className="role-card-header">
                                        <Shield size={16} />
                                        <span className="role-name">Administrator</span>
                                    </div>
                                    <span className="role-desc">Standard administrative access to user directory and metrics</span>
                                </button>

                                <button
                                    type="button"
                                    className={`role-option-card super ${form.role === 'super_admin' ? 'selected' : ''}`}
                                    onClick={() => setForm({ ...form, role: 'super_admin' })}
                                >
                                    <div className="role-card-header">
                                        <ShieldCheck size={16} />
                                        <span className="role-name">Super Admin</span>
                                    </div>
                                    <span className="role-desc">Full governance over roles, credits, database, and billing</span>
                                </button>
                            </div>
                        </div>

                        <div className="form-actions-row">
                            <button
                                type="submit"
                                className="console-submit-btn"
                                disabled={submitting}
                            >
                                <KeyRound size={15} />
                                <span>{submitting ? 'Creating Admin...' : 'Create Administrator'}</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* Current Admins List */}
                <div className="current-admins-card">
                    <div className="section-title-row">
                        <div className="title-with-icon">
                            <Users size={18} className="icon-accent" />
                            <div>
                                <h3>Active Platform Administrators</h3>
                                <span className="section-sub">Total: {stats?.totalAdmins || adminAccounts.length} Verified Accounts</span>
                            </div>
                        </div>
                    </div>

                    <div className="admins-list">
                        {adminAccounts.length === 0 ? (
                            <div className="empty-state-card">
                                <span>No secondary admins found in current view.</span>
                            </div>
                        ) : (
                            adminAccounts.map((adm) => (
                                <div key={adm._id} className="admin-account-row">
                                    <div className="admin-avatar">
                                        {(adm.username || 'A')[0].toUpperCase()}
                                    </div>
                                    <div className="admin-meta">
                                        <span className="admin-username">{adm.username}</span>
                                        <span className="admin-email">{adm.email}</span>
                                    </div>
                                    <div className="admin-role-badge">
                                        <span className={`badge-pill ${adm.role === 'super_admin' ? 'role-super' : 'role-admin'}`}>
                                            {adm.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
