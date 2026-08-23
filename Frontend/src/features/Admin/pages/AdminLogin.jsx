import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Auth/hooks/useAuth';
import { getMe } from '../../Auth/services/auth.api';
import '../styles/admin.scss';

export default function AdminLogin() {
    const navigate = useNavigate();
    const { handleLogin, handleLogout } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email.trim() || !password) {
            setError('Please enter both Email and Password.');
            return;
        }

        setSubmitting(true);
        try {
            const loginRes = await handleLogin({ email, password });
            
            // Check fresh role from response or getMe
            let userRole = loginRes?.user?.role;
            let isAdminUser = loginRes?.user?.isAdmin;
            if (!userRole) {
                const meData = await getMe();
                userRole = meData?.user?.role;
                isAdminUser = meData?.user?.isAdmin;
            }

            if (userRole === 'admin' || userRole === 'super_admin' || isAdminUser) {
                navigate('/admin-portal-dashboard-root', { replace: true });
            } else {
                await handleLogout();
                setError('Access Denied: Account is not authorized as an Administrator.');
            }
        } catch (err) {
            console.error("Admin Login Error:", err);
            setError(err?.response?.data?.message || 'Invalid administrator credentials.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="admin-login-page">
            <div className="admin-login-card">
                <div className="admin-login-header">
                    <div className="admin-badge-icon">🛡️</div>
                    <h2>Admin Portal Login</h2>
                    <span className="admin-subtext">Restricted Access · Authorized Personnel Only</span>
                </div>

                {error && (
                    <div className="admin-error-banner">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="admin-login-form">
                    <div className="form-group">
                        <label>Admin Email Address</label>
                        <input
                            type="email"
                            placeholder="admin@domain.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Master Password</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="toggle-pass-btn"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="admin-submit-btn" disabled={submitting}>
                        {submitting ? 'Authenticating...' : 'Authenticate & Enter Portal 🚀'}
                    </button>
                </form>

                <div className="admin-login-footer">
                    <a href="/" className="back-link">← Return to Application</a>
                </div>
            </div>
        </div>
    );
}
