import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
    ShieldCheck, 
    Lock, 
    Mail, 
    KeyRound, 
    Eye, 
    EyeOff, 
    ArrowLeft, 
    AlertCircle, 
    CheckCircle2, 
    Loader2, 
    Info, 
    RefreshCw, 
    Fingerprint 
} from 'lucide-react';
import { useAuth } from '../../Auth/hooks/useAuth';
import { getMe } from '../../Auth/services/auth.api';
import '../styles/adminLogin.scss';

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
    const [resendCooldown, setResendCooldown] = useState(0);

    // Auto-redirect if already logged in as Admin / Super Admin
    useEffect(() => {
        if (user && (user.isAdmin || user.role === 'admin' || user.role === 'super_admin')) {
            navigate('/admin-portal-dashboard-root', { replace: true });
        }
    }, [user, navigate]);

    // Resend countdown timer
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const interval = setInterval(() => {
            setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [resendCooldown]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfoMessage('');

        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !password) {
            setError('Please provide both administrative email and master password.');
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
                setError('Access Denied: Account is not authorized with Administrator credentials.');
            }
        } catch (err) {
            console.error("Admin Login Error:", err);
            if (err?.response?.status === 403 && err?.response?.data?.requiresOtp) {
                const data = err.response.data;
                setInfoMessage(data.message || 'Security verification required. A 6-digit OTP has been sent to your email.');
                if (data.fallbackOtp) setOtp(data.fallbackOtp);
                setResendCooldown(60);
                setStep(2);
            } else {
                setError(err?.response?.data?.message || err?.message || 'Invalid administrator email or password.');
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
            setError('Please enter the 6-digit verification OTP code.');
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
                setError('Access Denied: Account is not authorized with Administrator credentials.');
                setStep(1);
            }
        } catch (err) {
            console.error("Admin OTP Verification Error:", err);
            setError(err?.response?.data?.message || err?.message || 'Invalid or expired verification OTP code.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setError('');
        setInfoMessage('');
        try {
            const cleanEmail = email.trim().toLowerCase();
            const res = await handleResendOtp({ email: cleanEmail });
            setInfoMessage(res?.message || 'A new verification OTP has been sent to your email.');
            if (res?.fallbackOtp) setOtp(res.fallbackOtp);
            setResendCooldown(60);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to resend verification OTP. Please try again.');
        }
    };

    return (
        <div className="admin-login-page">
            <div className="admin-login-container">
                {/* Security Status Pill */}
                <div className="admin-status-pill">
                    <span className="status-dot"></span>
                    <span className="status-text">Encrypted Console</span>
                    <span className="status-badge">TLS 1.3</span>
                </div>

                {/* Login Card */}
                <div className="admin-login-card">
                    <div className="admin-login-header">
                        <div className="admin-badge-icon">
                            <span className="icon-glow"></span>
                            <ShieldCheck size={28} />
                        </div>
                        <h2>Admin Portal Login</h2>
                        <span className="admin-subtext">Restricted Access · Authorized Personnel Only</span>
                    </div>

                    {/* Non-Admin Session Alert */}
                    {user && !user.isAdmin && !['admin', 'super_admin'].includes(user.role) && (
                        <div className="admin-session-notice">
                            <Info size={16} className="notice-icon" />
                            <div>
                                Currently authenticated as <strong>{user.email}</strong> (Standard User). Submitting valid admin credentials will switch your session.
                            </div>
                        </div>
                    )}

                    {/* Error Banner */}
                    {error && (
                        <div className="admin-error-banner">
                            <AlertCircle size={16} className="error-icon" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Info / OTP Banner */}
                    {infoMessage && (
                        <div className="admin-info-banner">
                            <CheckCircle2 size={16} className="info-icon" />
                            <span>{infoMessage}</span>
                        </div>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleSubmit} className="admin-login-form">
                            <div className="form-group">
                                <label>
                                    <Mail size={13} className="label-icon" />
                                    Admin Email Address
                                </label>
                                <div className="input-field-wrapper">
                                    <span className="input-lead-icon">
                                        <Mail size={16} />
                                    </span>
                                    <input
                                        type="email"
                                        placeholder="admin@domain.com"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (error) setError('');
                                        }}
                                        required
                                        autoFocus
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>
                                    <Lock size={13} className="label-icon" />
                                    Master Password
                                </label>
                                <div className="input-field-wrapper">
                                    <span className="input-lead-icon">
                                        <KeyRound size={16} />
                                    </span>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="••••••••••••"
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            if (error) setError('');
                                        }}
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        className="toggle-pass-btn"
                                        onClick={() => setShowPassword(!showPassword)}
                                        title={showPassword ? "Hide password" : "Show password"}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" className="admin-submit-btn" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 size={18} className="btn-spinner" />
                                        <span>Authenticating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Fingerprint size={18} />
                                        <span>Authenticate & Enter Portal</span>
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleOtpSubmit} className="admin-login-form">
                            <div className="form-group">
                                <label>
                                    <KeyRound size={13} className="label-icon" />
                                    6-Digit Verification OTP
                                </label>
                                <div className="input-field-wrapper">
                                    <input
                                        type="text"
                                        className="otp-input"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => {
                                            setOtp(e.target.value.replace(/\D/g, ''));
                                            if (error) setError('');
                                        }}
                                        required
                                        autoFocus
                                        autoComplete="one-time-code"
                                    />
                                </div>
                            </div>

                            <div className="otp-aux-bar">
                                <button
                                    type="button"
                                    className="resend-btn"
                                    onClick={handleResend}
                                    disabled={resendCooldown > 0}
                                >
                                    <RefreshCw size={12} className={resendCooldown > 0 ? '' : ''} />
                                    {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
                                </button>
                                <button
                                    type="button"
                                    className="back-step-btn"
                                    onClick={() => {
                                        setStep(1);
                                        setError('');
                                    }}
                                >
                                    ← Back to Password
                                </button>
                            </div>

                            <button type="submit" className="admin-submit-btn" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 size={18} className="btn-spinner" />
                                        <span>Verifying Credentials...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={18} />
                                        <span>Verify OTP & Enter Console</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    <div className="admin-login-footer">
                        <Link to="/" className="back-link">
                            <ArrowLeft size={14} className="back-arrow-icon" />
                            <span>Return to Application</span>
                        </Link>
                        <div className="admin-security-tag">
                            Unauthorized access attempts are monitored and logged to Security Incident Response.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
