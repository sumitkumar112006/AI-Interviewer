import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import PageLoading from '../../Shared/components/PageLoading'
import InteractiveAuthMascot from '../components/InteractiveAuthMascot'
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
            setInfoMessage(res?.message || 'Reset code sent! Please check your Gmail inbox.')
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
        <main className="auth-page-root">
            <div className="auth-card">
                {/* ── Static 3D Mascot sitting on top edge of card ── */}
                <InteractiveAuthMascot />

                {/* ── Brand ── */}
                <div className="auth-brand">
                    <div className="auth-brand-icon">⚡</div>
                    <span className="auth-brand-name">InterviewAI</span>
                </div>

                {/* ── Info message across steps ── */}
                {infoMessage && <div className="auth-info-msg">{infoMessage}</div>}

                {step === 1 && (
                    <>
                        {/* ── Header ── */}
                        <div className="auth-header">
                            <h1>Sign in</h1>
                            <p className="auth-subtitle">
                                Welcome back! Enter your credentials to access your account.
                            </p>
                        </div>

                        {/* ── Google Sign-In ── */}
                        <GoogleAuthButton onError={setError} text="Continue with Google" />

                        <div className="auth-oauth-divider">
                            <span>or sign in with email</span>
                        </div>

                        {/* ── Error / Validation messages ── */}
                        {error && <div className="auth-error-msg">{error}</div>}
                        {validationError && <div className="auth-error-msg">{validationError}</div>}

                        {/* ── Form ── */}
                        <form className="auth-form" onSubmit={handleSubmit} noValidate>

                            {/* Email */}
                            <div className="auth-input-group">
                                <label htmlFor="login-email">Email</label>
                                <div className="auth-input-wrapper">
                                    <input
                                        id="login-email"
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value)
                                            setValidationError('')
                                        }}
                                        className={emailValid ? 'has-value' : ''}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="auth-input-group">
                                <div className="auth-label-row">
                                    <label htmlFor="login-password">Password</label>
                                    <button
                                        type="button"
                                        className="forgot-pass-btn"
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
                                        className={passwordValid ? 'has-value' : ''}
                                    />
                                    <button
                                        type="button"
                                        className="eye-toggle"
                                        onClick={() => setShowPassword(p => !p)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeClosed /> : <EyeOpen />}
                                    </button>
                                </div>
                            </div>

                            {/* ── Submit Button ── */}
                            <button
                                type="submit"
                                className="auth-submit-btn"
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="auth-spinner" />
                                ) : (
                                    <>
                                        <span>Log in</span>
                                        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ width: 16, height: 16 }}>
                                            <path
                                                fillRule="evenodd"
                                                d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </>
                                )}
                            </button>

                        </form>

                        <div className="auth-divider" />

                        <p className="auth-footer-link">
                            Don't have an account?
                            <Link to="/register">Create one</Link>
                        </p>
                    </>
                )}

                {step === 2 && (
                    <>
                        {/* ── OTP Step for Unverified Login ── */}
                        <div className="auth-header">
                            <h1>Verify your email</h1>
                            <p className="otp-header-info">
                                We sent a 6-digit code to <strong>{email}</strong>.
                                Check your inbox.
                            </p>
                        </div>

                        {error && <div className="auth-error-msg">{error}</div>}

                        <form className="auth-form" onSubmit={handleVerifyOtpSubmit}>
                            <div className="auth-input-group">
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
                                className="auth-submit-btn"
                                disabled={loading || otp.length < 6}
                            >
                                {loading ? <span className="auth-spinner" /> : 'Verify & Log in'}
                            </button>
                        </form>

                        <div className="otp-actions">
                            <button
                                type="button"
                                className="back-btn"
                                onClick={() => { setStep(1); setError(''); setInfoMessage('') }}
                            >
                                ← Back to login
                            </button>
                            <button type="button" className="resend-btn" onClick={handleResend}>
                                Resend code
                            </button>
                        </div>
                    </>
                )}

                {step === 3 && (
                    <>
                        {/* ── Step 3: Forgot Password - Request OTP ── */}
                        <div className="auth-header">
                            <h1>Forgot Password</h1>
                            <p className="auth-subtitle">
                                Enter your registered email address to receive a 6-digit reset code via Gmail.
                            </p>
                        </div>

                        {error && <div className="auth-error-msg">{error}</div>}
                        {validationError && <div className="auth-error-msg">{validationError}</div>}

                        <form className="auth-form" onSubmit={handleForgotPasswordSubmit}>
                            <div className="auth-input-group">
                                <label htmlFor="forgot-email">Email Address</label>
                                <div className="auth-input-wrapper">
                                    <input
                                        id="forgot-email"
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value)
                                            setValidationError('')
                                        }}
                                        className={emailValid ? 'has-value' : ''}
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="auth-submit-btn"
                                disabled={loading || !emailValid}
                            >
                                {loading ? <span className="auth-spinner" /> : 'Send Reset Code'}
                            </button>
                        </form>

                        <div className="otp-actions">
                            <button
                                type="button"
                                className="back-btn"
                                onClick={() => { setStep(1); setError(''); setInfoMessage('') }}
                            >
                                ← Back to login
                            </button>
                        </div>
                    </>
                )}

                {step === 4 && (
                    <>
                        {/* ── Step 4: Reset Password - OTP & New Password ── */}
                        <div className="auth-header">
                            <h1>Reset Password</h1>
                            <p className="otp-header-info">
                                Enter the 6-digit code sent to <strong>{email}</strong> along with your new password.
                            </p>
                        </div>

                        {error && <div className="auth-error-msg">{error}</div>}

                        <form className="auth-form" onSubmit={handleResetPasswordSubmit}>
                            {/* OTP Code */}
                            <div className="auth-input-group">
                                <label htmlFor="reset-otp">6-Digit Code</label>
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

                            {/* New Password */}
                            <div className="auth-input-group">
                                <label htmlFor="reset-new-password">New Password</label>
                                <div className="auth-input-wrapper with-icon">
                                    <input
                                        id="reset-new-password"
                                        type={showNewPassword ? 'text' : 'password'}
                                        name="newPassword"
                                        placeholder="At least 6 characters"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className={newPasswordValid ? 'has-value' : ''}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="eye-toggle"
                                        onClick={() => setShowNewPassword(p => !p)}
                                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showNewPassword ? <EyeClosed /> : <EyeOpen />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="auth-submit-btn"
                                disabled={loading || otp.length < 6 || !newPasswordValid}
                            >
                                {loading ? <span className="auth-spinner" /> : 'Reset Password'}
                            </button>
                        </form>

                        <div className="otp-actions">
                            <button
                                type="button"
                                className="back-btn"
                                onClick={() => { setStep(1); setError(''); setInfoMessage('') }}
                            >
                                ← Back to login
                            </button>
                            <button
                                type="button"
                                className="resend-btn"
                                onClick={handleForgotPasswordSubmit}
                            >
                                Resend code
                            </button>
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}

export default Login
