import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import PageLoading from '../../Shared/components/PageLoading'
import GoogleAuthButton from '../components/GoogleAuthButton'
import '../styles/auth.scss'

/* ── Eye icons ── */
const EyeOpen = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
)

const EyeClosed = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
)

const Login = () => {
    const navigate = useNavigate()
    const {
        loading,
        handleLogin,
        handleVerifyOtp,
        handleResendOtp,
        handleForgotPassword,
        handleResetPassword
    } = useAuth()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)

    const [error, setError] = useState('')
    const [infoMessage, setInfoMessage] = useState('')
    const [validationError, setValidationError] = useState('')

    const [step, setStep] = useState(1) // 1: Login, 2: Login OTP, 3: Forgot Pass Email, 4: Reset Pass OTP & New Pass
    const [otp, setOtp] = useState('')

    const emailValid = email.trim().length > 0 && email.includes('@')
    const passwordValid = password.length >= 1
    const newPasswordValid = newPassword.length >= 6

    /* ── Step 1: Login submit ── */
    const handleSubmit = async (e) => {
        if (e) e.preventDefault()
        setError('')
        setInfoMessage('')
        setValidationError('')

        if (!emailValid || !passwordValid) {
            setValidationError('Please fill in both email and password before submitting.')
            return
        }

        try {
            await handleLogin({ email, password })
            navigate('/')
        } catch (err) {
            console.error('Login error:', err)
            if (err?.response?.status === 403 && err?.response?.data?.requiresOtp) {
                const data = err.response.data
                setInfoMessage(data.message || 'Your email is not verified. A code has been sent to your inbox.')
                if (data.fallbackOtp) setOtp(data.fallbackOtp)
                setStep(2)
            } else {
                setError(err?.response?.data?.message || err?.message || 'Login failed. Please check your credentials.')
            }
        }
    }

    /* ── Step 2: OTP verify ── */
    const handleVerifyOtpSubmit = async (e) => {
        e.preventDefault()
        setError('')
        try {
            await handleVerifyOtp({ email, otp })
            navigate('/')
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Invalid OTP code.')
        }
    }

    const handleResend = async () => {
        setError('')
        setInfoMessage('')
        try {
            const res = await handleResendOtp({ email })
            setInfoMessage(res?.message || 'Verification code resent to your email.')
            if (res?.fallbackOtp) setOtp(res.fallbackOtp)
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to resend OTP.')
        }
    }

    /* ── Step 3: Request Forgot Password OTP ── */
    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setInfoMessage('')
        setValidationError('')

        if (!emailValid) {
            setValidationError('Please enter a valid email address.')
            return
        }

        try {
            const res = await handleForgotPassword({ email })
            setInfoMessage(res?.message || 'Reset code sent! Please check your inbox.')
            setOtp('')
            setStep(4)
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to send reset code. Please try again.')
        }
    }

    /* ── Step 4: Reset Password Submit ── */
    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setInfoMessage('')

        if (otp.length < 6) {
            setError('Please enter the full 6-digit OTP code.')
            return
        }

        if (!newPasswordValid) {
            setError('New password must be at least 6 characters long.')
            return
        }

        try {
            const res = await handleResetPassword({ email, otp, newPassword })
            setInfoMessage(res?.message || 'Password reset successfully! Please log in.')
            setPassword('')
            setNewPassword('')
            setOtp('')
            setStep(1)
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to reset password. Please check your code.')
        }
    }

    if (loading) {
        return <main><PageLoading title="Authenticating..." subtitle="Verifying your session..." /></main>
    }

    return (
        <div className="auth-page-root">
            {/* ── Top Navbar ── */}
            <header className="auth-navbar">
                <div className="auth-navbar-inner">
                    <Link to="/" className="auth-nav-brand">
                        <img src="/Logo.png" alt="KIVI-AI Logo" className="auth-brand-logo-img" />
                        <span className="auth-brand-name">KIVI-AI</span>
                    </Link>
                    <div className="auth-nav-actions">
                        <Link to="/register" className="auth-nav-cta-btn">
                            Practice Free Mock Interview
                        </Link>
                        <Link to="/register" className="auth-nav-link">
                            Create Account
                        </Link>
                    </div>
                </div>
            </header>

            {/* ── Centered Main Body ── */}
            <main className="auth-main-content">
                <div className="auth-form-card">

                    {/* Step 1: Login */}
                    {step === 1 && (
                        <>
                            <div className="auth-header">
                                <h1>Account Login</h1>
                                <p className="auth-subtitle">
                                    Welcome back! Enter your email and password to access your account.
                                </p>
                            </div>

                            {infoMessage && <div className="auth-alert auth-alert-info">{infoMessage}</div>}
                            {error && <div className="auth-alert auth-alert-error">{error}</div>}
                            {validationError && <div className="auth-alert auth-alert-warning">{validationError}</div>}

                            {/* Google Sign-In */}
                            <GoogleAuthButton onError={setError} text="Continue with Google" />

                            <div className="auth-oauth-divider">
                                <span>or sign in with email</span>
                            </div>

                            <form className="auth-form" onSubmit={handleSubmit} noValidate>
                                {/* Email */}
                                <div className="auth-field">
                                    <label htmlFor="login-email">Email address</label>
                                    <div className="auth-input-wrapper">
                                        <input
                                            id="login-email"
                                            type="email"
                                            name="email"
                                            autoComplete="email"
                                            placeholder="name@company.com"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value)
                                                setValidationError('')
                                            }}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="auth-field">
                                    <div className="auth-label-row">
                                        <label htmlFor="login-password">Password</label>
                                        <button
                                            type="button"
                                            className="auth-forgot-link"
                                            onClick={() => {
                                                setStep(3)
                                                setError('')
                                                setInfoMessage('')
                                                setValidationError('')
                                            }}
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                    <div className="auth-input-wrapper with-icon">
                                        <input
                                            id="login-password"
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            autoComplete="current-password"
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value)
                                                setValidationError('')
                                            }}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="auth-eye-btn"
                                            onClick={() => setShowPassword(p => !p)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeClosed /> : <EyeOpen />}
                                        </button>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    className="auth-btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? <span className="auth-spinner" /> : 'Log in'}
                                </button>
                            </form>

                            {/* Data Protection & Privacy Consent */}
                            <div className="auth-privacy-consent-box">
                                <p className="auth-privacy-consent-text">
                                    Protected by KIVI-AI Data Governance. View our{' '}
                                    <Link to="/privacy-policy" className="auth-consent-link">Privacy Policy</Link>{' '}
                                    &amp;{' '}
                                    <Link to="/terms-of-service" className="auth-consent-link">Terms</Link>.
                                </p>
                            </div>

                            <p className="auth-switch-text">
                                Don't have an account?
                                <Link to="/register">Create one</Link>
                            </p>
                        </>
                    )}

                    {/* Step 2: Email OTP Verify */}
                    {step === 2 && (
                        <>
                            <div className="auth-header">
                                <h1>Verify Your Email</h1>
                                <p className="auth-subtitle">
                                    We sent a 6-digit verification code to <strong>{email}</strong>.
                                </p>
                            </div>

                            {infoMessage && <div className="auth-alert auth-alert-info">{infoMessage}</div>}
                            {error && <div className="auth-alert auth-alert-error">{error}</div>}

                            <form className="auth-form" onSubmit={handleVerifyOtpSubmit}>
                                <div className="auth-field">
                                    <label htmlFor="login-otp">6-Digit verification code</label>
                                    <div className="auth-input-wrapper">
                                        <input
                                            id="login-otp"
                                            type="text"
                                            name="otp"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="849201"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="otp-input"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="auth-btn-primary"
                                    disabled={loading || otp.length < 6}
                                >
                                    {loading ? <span className="auth-spinner" /> : 'Verify & Log in'}
                                </button>
                            </form>

                            <div className="otp-actions-row">
                                <button
                                    type="button"
                                    className="back-action-btn"
                                    onClick={() => { setStep(1); setError(''); setInfoMessage('') }}
                                >
                                    ← Back to login
                                </button>
                                <button
                                    type="button"
                                    className="resend-action-btn"
                                    onClick={handleResend}
                                >
                                    Resend code
                                </button>
                            </div>
                        </>
                    )}

                    {/* Step 3: Forgot Password Request */}
                    {step === 3 && (
                        <>
                            <div className="auth-header">
                                <h1>Reset Password</h1>
                                <p className="auth-subtitle">
                                    Enter your registered email address to receive a 6-digit verification code.
                                </p>
                            </div>

                            {error && <div className="auth-alert auth-alert-error">{error}</div>}
                            {validationError && <div className="auth-alert auth-alert-warning">{validationError}</div>}

                            <form className="auth-form" onSubmit={handleForgotPasswordSubmit}>
                                <div className="auth-field">
                                    <label htmlFor="forgot-email">Email address</label>
                                    <div className="auth-input-wrapper">
                                        <input
                                            id="forgot-email"
                                            type="email"
                                            name="email"
                                            autoComplete="email"
                                            placeholder="name@company.com"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value)
                                                setValidationError('')
                                            }}
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="auth-btn-primary"
                                    disabled={loading || !emailValid}
                                >
                                    {loading ? <span className="auth-spinner" /> : 'Send reset code'}
                                </button>
                            </form>

                            <div className="otp-actions-row" style={{ justifyContent: 'center' }}>
                                <button
                                    type="button"
                                    className="back-action-btn"
                                    onClick={() => { setStep(1); setError(''); setInfoMessage('') }}
                                >
                                    ← Back to login
                                </button>
                            </div>
                        </>
                    )}

                    {/* Step 4: Reset Password Submit */}
                    {step === 4 && (
                        <>
                            <div className="auth-header">
                                <h1>Account Activation</h1>
                                <p className="auth-subtitle">
                                    Enter the 6-digit code sent to <strong>{email}</strong> and set your new password.
                                </p>
                            </div>

                            {infoMessage && <div className="auth-alert auth-alert-info">{infoMessage}</div>}
                            {error && <div className="auth-alert auth-alert-error">{error}</div>}

                            <form className="auth-form" onSubmit={handleResetPasswordSubmit}>
                                <div className="auth-field">
                                    <label htmlFor="reset-otp">6-Digit verification code</label>
                                    <div className="auth-input-wrapper">
                                        <input
                                            id="reset-otp"
                                            type="text"
                                            name="otp"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="849201"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="otp-input"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="auth-field">
                                    <label htmlFor="reset-new-password">New password</label>
                                    <div className="auth-input-wrapper with-icon">
                                        <input
                                            id="reset-new-password"
                                            type={showNewPassword ? 'text' : 'password'}
                                            name="newPassword"
                                            placeholder="Enter new password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="auth-eye-btn"
                                            onClick={() => setShowNewPassword(p => !p)}
                                            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showNewPassword ? <EyeClosed /> : <EyeOpen />}
                                        </button>
                                    </div>
                                    <div className="auth-req-list">
                                        <span className={`req-item ${newPassword.length >= 6 ? 'valid' : ''}`}>
                                            ✓ At least 6 characters
                                        </span>
                                        <span className={`req-item ${/[A-Z]/.test(newPassword) ? 'valid' : ''}`}>
                                            ✓ An uppercase letter
                                        </span>
                                        <span className={`req-item ${/[0-9]/.test(newPassword) ? 'valid' : ''}`}>
                                            ✓ At least one number
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="auth-btn-primary"
                                    disabled={loading || otp.length < 6 || !newPasswordValid}
                                >
                                    {loading ? <span className="auth-spinner" /> : 'Set password'}
                                </button>
                            </form>

                            <div className="otp-actions-row">
                                <button
                                    type="button"
                                    className="back-action-btn"
                                    onClick={() => { setStep(1); setError(''); setInfoMessage('') }}
                                >
                                    ← Back to login
                                </button>
                                <button
                                    type="button"
                                    className="resend-action-btn"
                                    onClick={handleForgotPasswordSubmit}
                                >
                                    Resend code
                                </button>
                            </div>
                        </>
                    )}

                </div>
            </main>

            {/* ── Split Footer (Matching Reference Screenshot) ── */}
            <footer className="auth-footer">
                <div className="auth-footer-inner">
                    <div className="auth-footer-left">
                        <p>
                            KIVI-AI provides AI-powered resume building, interview practice, and career tools. Please read our <Link to="/privacy-policy">Privacy Policy</Link> and <Link to="/terms-of-service">Terms of Use</Link>.
                        </p>
                    </div>
                    <div className="auth-footer-right">
                        <p>
                            Email our support team at <a href="mailto:support@kivi-ai.com">support@kivi-ai.com</a><br />
                            KIVI-AI.com © 2022 - 2026. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default Login
