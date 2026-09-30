import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../Auth/hooks/useAuth';
import { getMe } from '../../Auth/services/auth.api';
import '../styles/admin.scss';

export default function AdminLogin() {
    const navigate = useNavigate();
    const { user, handleLogin, handleVerifyOtp, handleResendOtp, handleLogout } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState(1); // 1: Credentials, 2: OTP verification
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Auto-redirect if already logged in as Admin / Super Admin
    useEffect(() => {
        if (user && (user.isAdmin || user.role === 'admin' || user.role === 'super_admin')) {
            navigate('/admin-portal-dashboard-root', { replace: true });
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfoMessage('');

        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !password) {
            setError('Please enter both Email and Password.');
            return;
        }

        setSubmitting(true);
        try {
            const loginRes = await handleLogin({ email: cleanEmail, password });
            
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
            if (err?.response?.status === 403 && err?.response?.data?.requiresOtp) {
                const data = err.response.data;
                setInfoMessage(data.message || 'Verification required. A code has been sent to your email.');
                if (data.fallbackOtp) setOtp(data.fallbackOtp);
                setStep(2);
            } else {
                setError(err?.response?.data?.message || err?.message || 'Invalid administrator credentials.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfoMessage('');

        if (!otp.trim()) {
            setError('Please enter the 6-digit OTP code.');
            return;
        }

        setSubmitting(true);
        try {
            const cleanEmail = email.trim().toLowerCase();
            const verifyRes = await handleVerifyOtp({ email: cleanEmail, otp: otp.trim() });
            
            let userRole = verifyRes?.user?.role;
            let isAdminUser = verifyRes?.user?.isAdmin;
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
                setStep(1);
            }
        } catch (err) {
            console.error("Admin OTP Verification Error:", err);
            setError(err?.response?.data?.message || err?.message || 'Invalid verification OTP code.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResend = async () => {
        setError('');
        setInfoMessage('');
        try {
            const cleanEmail = email.trim().toLowerCase();
            const res = await handleResendOtp({ email: cleanEmail });
            setInfoMessage(res?.message || 'Verification code resent to your email.');
            if (res?.fallbackOtp) setOtp(res.fallbackOtp);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to resend OTP.');
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

                {user && !user.isAdmin && !['admin', 'super_admin'].includes(user.role) && (
                    <div style={{
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#93c5fd',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        marginBottom: '1.2rem',
                        lineHeight: '1.4'
                    }}>
                        ℹ️ Currently logged in as <strong style={{ color: '#ffffff' }}>{user.email}</strong>. Logging in here will switch to your Administrator account.
                    </div>
                )}

                {error && (
                    <div className="admin-error-banner">
                        ⚠️ {error}
                    </div>
                )}

                {infoMessage && (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                        padding: '0.7rem 0.9rem',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        marginBottom: '1.5rem',
                        textAlign: 'center'
                    }}>
                        ✨ {infoMessage}
                    </div>
                )}

                {step === 1 ? (
                    <form onSubmit={handleSubmit} className="admin-login-form">
                        <div className="form-group">
                            <label>Admin Email Address</label>
                            <input
                                type="email"
                                placeholder="admin@domain.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
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
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="admin-submit-btn" disabled={submitting}>
                            {submitting ? 'Authenticating...' : 'Authenticate & Enter Portal 🚀'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleOtpSubmit} className="admin-login-form">
                        <div className="form-group">
                            <label>6-Digit Verification Code</label>
                            <input
                                type="text"
                                placeholder="123456"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                required
                                autoFocus
                                style={{ letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.8rem' }}>
                            <button
                                type="button"
                                onClick={handleResend}
                                style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                Resend Code
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                            >
                                ← Back to Password
                            </button>
                        </div>

                        <button type="submit" className="admin-submit-btn" disabled={submitting}>
                            {submitting ? 'Verifying...' : 'Verify OTP & Enter Portal 🚀'}
                        </button>
                    </form>
                )}

                <div className="admin-login-footer">
                    <Link to="/" className="back-link">← Return to Application</Link>
                </div>
            </div>
        </div>
    );
}
