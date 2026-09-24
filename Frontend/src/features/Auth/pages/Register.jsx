import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const [error, setError] = useState('')
    const [infoMessage, setInfoMessage] = useState('')
    const [validationError, setValidationError] = useState('')

    const usernameValid = username.trim().length >= 2
    const emailValid = email.trim().length > 0 && email.includes('@')
    const passwordValid = password.length >= 6
    const confirmValid = confirmPassword.length >= 1 && confirmPassword === password

    /* ── Step 1: Register submit ── */
    const handleRegisterSubmit = async (e) => {
        if (e) e.preventDefault()
        setError('')
        setInfoMessage('')
        setValidationError('')

        if (!usernameValid || !emailValid || !passwordValid || !confirmPassword) {
            setValidationError('Please complete all fields before submitting.')
            return
        }

        if (password !== confirmPassword) {
            setValidationError('Passwords do not match. Please verify.')
            return
        }

        if (!agreedToTerms) {
            setValidationError('Please agree to the Terms of Service and Privacy Policy.')
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
        <div className="auth-page-root">
            {/* ── Top Navbar ── */}
            <header className="auth-navbar">
                <div className="auth-navbar-inner">
                    <Link to="/" className="auth-nav-brand">
                        <img src="/Logo.png" alt="KIVI-AI Logo" className="auth-brand-logo-img" />
                        <span className="auth-brand-name">KIVI-AI</span>
                    </Link>
                    <div className="auth-nav-actions">
                        <Link to="/login" className="auth-nav-cta-btn">
                            Generate Resume, T&amp;Cs...
                        </Link>
                        <Link to="/login" className="auth-nav-link">
                            Login
                        </Link>
                    </div>
                </div>
            </header>

            {/* ── Centered Main Body ── */}
            <main className="auth-main-content">
                <div className="auth-form-card">

                    {step === 1 ? (
                        <>
                            <div className="auth-header">
                                <h1>Create Your Account</h1>
                                <p className="auth-subtitle">
                                    Join KIVI-AI to generate resumes and practice mock interviews.
                                </p>
                            </div>

                            {infoMessage && <div className="auth-alert auth-alert-info">{infoMessage}</div>}
                            {error && <div className="auth-alert auth-alert-error">{error}</div>}
                            {validationError && <div className="auth-alert auth-alert-warning">{validationError}</div>}

                            {/* Google Sign-Up */}
                            <GoogleAuthButton onError={setError} text="Sign up with Google" />

                            <div className="auth-oauth-divider">
                                <span>or register with email</span>
                            </div>

                            <form className="auth-form" onSubmit={handleRegisterSubmit} noValidate>
                                {/* Full Name */}
                                <div className="auth-field">
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
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="auth-field">
                                    <label htmlFor="reg-email">Email address</label>
                                    <div className="auth-input-wrapper">
                                        <input
                                            id="reg-email"
                                            type="email"
                                            name="email"
                                            autoComplete="email"
                                            placeholder="name@company.com"
                                            value={email}
                                            onChange={(e) => { setEmail(e.target.value); setValidationError('') }}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="auth-field">
                                    <label htmlFor="reg-password">Password</label>
                                    <div className="auth-input-wrapper with-icon">
                                        <input
                                            id="reg-password"
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            autoComplete="new-password"
                                            placeholder="••••••••••••"
                                            value={password}
                                            onChange={(e) => { setPassword(e.target.value); setValidationError('') }}
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
                                    {/* Real-time requirements checklist */}
                                    <div className="auth-req-list">
                                        <span className={`req-item ${password.length >= 6 ? 'valid' : ''}`}>
                                            ✓ At least 6 characters
                                        </span>
                                        <span className={`req-item ${/[A-Z]/.test(password) ? 'valid' : ''}`}>
                                            ✓ An uppercase letter
                                        </span>
                                        <span className={`req-item ${/[0-9]/.test(password) ? 'valid' : ''}`}>
                                            ✓ At least one number
                                        </span>
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div className="auth-field">
                                    <label htmlFor="reg-confirm">Confirm password</label>
                                    <div className="auth-input-wrapper with-icon">
                                        <input
                                            id="reg-confirm"
                                            type={showConfirm ? 'text' : 'password'}
                                            name="confirmPassword"
                                            autoComplete="new-password"
                                            placeholder="••••••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => { setConfirmPassword(e.target.value); setValidationError('') }}
                                            className={
                                                confirmPassword.length > 0 && !confirmValid ? 'input-error' : ''
                                            }
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="auth-eye-btn"
                                            onClick={() => setShowConfirm(p => !p)}
                                            aria-label={showConfirm ? 'Hide password' : 'Show password'}
                                        >
                                            {showConfirm ? <EyeClosed /> : <EyeOpen />}
                                        </button>
                                    </div>
                                    {confirmPassword.length > 0 && (
                                        <div className="auth-req-list">
                                            <span className={`req-item ${confirmValid ? 'valid' : ''}`}>
                                                {confirmValid ? '✓ Passwords match' : '✕ Passwords do not match'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Terms of Service & Privacy Policy Checkbox */}
                                <div className="auth-consent-checkbox-group">
                                    <label className="auth-checkbox-label" htmlFor="reg-consent-checkbox">
                                        <input
                                            id="reg-consent-checkbox"
                                            type="checkbox"
                                            checked={agreedToTerms}
                                            onChange={(e) => {
                                                setAgreedToTerms(e.target.checked)
                                                if (e.target.checked) setValidationError('')
                                            }}
                                            className="auth-checkbox-input"
                                            required
                                        />
                                        <span className="auth-checkbox-text">
                                            I agree to the{' '}
                                            <Link to="/terms-of-service" target="_blank" rel="noopener noreferrer" className="auth-consent-link">
                                                Terms of Service
                                            </Link>{' '}
                                            and{' '}
                                            <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer" className="auth-consent-link">
                                                Privacy Policy
                                            </Link>
                                        </span>
                                    </label>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    className="auth-btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? <span className="auth-spinner" /> : 'Create account'}
                                </button>
                            </form>

                            {/* Data Security Guarantee */}
                            <div className="auth-privacy-consent-box">
                                <p className="auth-privacy-guarantee">
                                    🛡️ <strong>Zero Model Training:</strong> Your resumes and interview audio are encrypted (AES-256) and never used to train public AI models or shared with recruiters.
                                </p>
                            </div>

                            <p className="auth-switch-text">
                                Already have an account?
                                <Link to="/login">Sign in</Link>
                            </p>
                        </>
                    ) : (
                        <>
                            {/* OTP Step */}
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
                                    className="auth-btn-primary"
                                    disabled={loading || otp.length < 6}
                                >
                                    {loading ? <span className="auth-spinner" /> : 'Verify & Create account'}
                                </button>
                            </form>

                            <div className="otp-actions-row">
                                <button
                                    type="button"
                                    className="back-action-btn"
                                    onClick={() => { setStep(1); setError(''); setInfoMessage('') }}
                                >
                                    ← Change email
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

export default Register
