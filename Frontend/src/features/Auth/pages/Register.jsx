import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import PageLoading from '../../Shared/components/PageLoading'
import InteractiveAuthMascot from '../components/InteractiveAuthMascot'
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

const Register = () => {
    const navigate = useNavigate()
    const { loading, handleRegister, handleVerifyOtp, handleResendOtp } = useAuth()

    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const [step, setStep] = useState(1)
    const [otp, setOtp] = useState('')
    const [error, setError] = useState('')
    const [infoMessage, setInfoMessage] = useState('')
    const [validationError, setValidationError] = useState('')

    /* Count valid fields for progress bar (out of 4) */
    const usernameValid = username.trim().length >= 2
    const emailValid = email.trim().length > 0 && email.includes('@')
    const passwordValid = password.length >= 6
    const confirmValid = confirmPassword.length >= 1 && confirmPassword === password
    const completedFields =
        (usernameValid ? 1 : 0) +
        (emailValid ? 1 : 0) +
        (passwordValid ? 1 : 0) +
        (confirmValid ? 1 : 0)

    /* ── Step 1: Register submit ── */
    const handleRegisterSubmit = async (e) => {
        if (e) e.preventDefault()
        setError('')
        setInfoMessage('')
        setValidationError('')

        if (completedFields < 4) {
            setValidationError('Please complete all fields before submitting.')
            return
        }

        if (password !== confirmPassword) {
            setValidationError('Passwords do not match. Please verify.')
            return
        }

        try {
            const data = await handleRegister({ username, email, password })
            setInfoMessage(data?.message || 'Registration initiated! Check your email for the OTP.')
            if (data?.fallbackOtp) setOtp(data.fallbackOtp)
            setStep(2)
        } catch (err) {
            console.error('Registration error:', err)
            setError(err?.response?.data?.message || err?.message || 'Registration failed. Please try again.')
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

    if (loading) {
        return <main><PageLoading title="Setting up account..." subtitle="Please wait..." /></main>
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

                {step === 1 ? (
                    <>
                        {/* ── Header ── */}
                        <div className="auth-header">
                            <h1>Create account</h1>
                            <p className="auth-subtitle">
                                Join InterviewAI to generate resumes and practice mock interviews.
                            </p>
                        </div>

                        {/* ── Progress indicator ── */}
                        <div style={{
                            display: 'flex',
                            gap: '6px',
                        }}>
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} style={{
                                    flex: 1,
                                    height: '3px',
                                    borderRadius: '99px',
                                    background: i < completedFields
                                        ? 'linear-gradient(90deg, #34d399, #06b6d4)'
                                        : 'rgba(255,255,255,0.1)',
                                    transition: 'background 0.3s ease',
                                }} />
                            ))}
                        </div>

                        {/* ── Errors ── */}
                        {error && <div className="auth-error-msg">{error}</div>}
                        {validationError && <div className="auth-error-msg">{validationError}</div>}

                        {/* ── Form ── */}
                        <form className="auth-form" onSubmit={handleRegisterSubmit} noValidate>

                            {/* Full Name */}
                            <div className="auth-input-group">
                                <label htmlFor="reg-username">Full name</label>
                                <div className="auth-input-wrapper">
                                    <input
                                        id="reg-username"
                                        type="text"
                                        name="username"
                                        autoComplete="name"
                                        placeholder="Jane Smith"
                                        value={username}
                                        onChange={(e) => { setUsername(e.target.value); setValidationError('') }}
                                        className={usernameValid ? 'has-value' : ''}
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="auth-input-group">
                                <label htmlFor="reg-email">Email</label>
                                <div className="auth-input-wrapper">
                                    <input
                                        id="reg-email"
                                        type="email"
                                        name="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setValidationError('') }}
                                        className={emailValid ? 'has-value' : ''}
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="auth-input-group">
                                <label htmlFor="reg-password">Password</label>
                                <div className="auth-input-wrapper with-icon">
                                    <input
                                        id="reg-password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        autoComplete="new-password"
                                        placeholder="Min. 6 characters"
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setValidationError('') }}
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

                            {/* Confirm Password */}
                            <div className="auth-input-group">
                                <label htmlFor="reg-confirm">Confirm password</label>
                                <div className="auth-input-wrapper with-icon">
                                    <input
                                        id="reg-confirm"
                                        type={showConfirm ? 'text' : 'password'}
                                        name="confirmPassword"
                                        autoComplete="new-password"
                                        placeholder="Repeat your password"
                                        value={confirmPassword}
                                        onChange={(e) => { setConfirmPassword(e.target.value); setValidationError('') }}
                                        className={
                                            confirmPassword.length > 0
                                                ? confirmValid ? 'has-value' : 'input-error'
                                                : ''
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="eye-toggle"
                                        onClick={() => setShowConfirm(p => !p)}
                                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                                    >
                                        {showConfirm ? <EyeClosed /> : <EyeOpen />}
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
                                        <span>Create account</span>
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
                            Already have an account?
                            <Link to="/login">Sign in</Link>
                        </p>
                    </>
                ) : (
                    <>
                        {/* ── OTP Step ── */}
                        <div className="auth-header">
                            <h1>Verify your email</h1>
                            <p className="otp-header-info">
                                We sent a 6-digit code to <strong>{email}</strong>.
                                Check your inbox.
                            </p>
                        </div>

                        {error && <div className="auth-error-msg">{error}</div>}
                        {infoMessage && <div className="auth-info-msg">{infoMessage}</div>}

                        <form className="auth-form" onSubmit={handleVerifyOtpSubmit}>
                            <div className="auth-input-group">
                                <label htmlFor="reg-otp">6-Digit verification code</label>
                                <div className="auth-input-wrapper">
                                    <input
                                        id="reg-otp"
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
                                {loading ? <span className="auth-spinner" /> : 'Verify & Create account'}
                            </button>
                        </form>

                        <div className="otp-actions">
                            <button
                                type="button"
                                className="back-btn"
                                onClick={() => { setStep(1); setError(''); setInfoMessage('') }}
                            >
                                ← Change email
                            </button>
                            <button type="button" className="resend-btn" onClick={handleResend}>
                                Resend code
                            </button>
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}

export default Register
