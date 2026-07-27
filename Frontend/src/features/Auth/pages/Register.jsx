import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingPage from '../../Interview/Loading'

const Register = () => {
    const navigate = useNavigate()

    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    // Step 1 = Register Form, Step 2 = OTP Verification Form
    const [step, setStep] = useState(1)
    const [otp, setOtp] = useState("")
    const [error, setError] = useState("")
    const [infoMessage, setInfoMessage] = useState("")

    const { loading, handleRegister, handleVerifyOtp, handleResendOtp } = useAuth()

    const handleRegisterSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setInfoMessage("")
        try {
            const data = await handleRegister({ username, email, password })
            setInfoMessage(data?.message || "Registration initiated! Please enter the OTP sent to your email.")
            setStep(2)
        } catch (err) {
            console.error('Registration error:', err)
            const message = err?.response?.data?.message || err?.message || 'Registration failed. Please try again.'
            setError(message)
        }
    }

    const handleVerifyOtpSubmit = async (e) => {
        e.preventDefault()
        setError("")
        try {
            await handleVerifyOtp({ email, otp })
            navigate('/')
        } catch (err) {
            console.error('OTP Verification error:', err)
            const message = err?.response?.data?.message || err?.message || 'Invalid verification OTP code.'
            setError(message)
        }
    }

    const handleResend = async () => {
        setError("")
        setInfoMessage("")
        try {
            const res = await handleResendOtp({ email })
            setInfoMessage(res?.message || "Verification code resent to your email.")
        } catch (err) {
            const message = err?.response?.data?.message || 'Failed to resend OTP. Please try again.'
            setError(message)
        }
    }

    if (loading) {
        return (
            <main>
                <LoadingPage />
            </main>
        )
    }

    return (
        <main>
            <div className="form-container">
                {step === 1 ? (
                    <>
                        <h1>Register</h1>
                        {error && <div className="error-message">{error}</div>}
                        <form className="auth-form" onSubmit={handleRegisterSubmit}>
                            <div className="input-group">
                                <label htmlFor="username">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    id="username"
                                    name="username"
                                    placeholder="Enter your username..."
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    id="email"
                                    name="email"
                                    placeholder="Enter your email..."
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label htmlFor="password">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    id="password"
                                    name="password"
                                    placeholder="Enter your password..."
                                    required
                                />
                            </div>

                            <button type="submit" className="button primary-btn">
                                Send Verification Code
                            </button>
                        </form>
                        <p>
                            Already have an Account?
                            <Link to="/login"> Login</Link>
                        </p>
                    </>
                ) : (
                    <>
                        <h1>Verify Your Email</h1>
                        <p style={{ color: '#8f9cae', fontSize: '0.9rem', marginTop: '-0.5rem' }}>
                            We sent a 6-digit verification code to <strong>{email}</strong>.
                        </p>

                        {error && <div className="error-message">{error}</div>}
                        {infoMessage && (
                            <div className="info-message" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.88rem' }}>
                                {infoMessage}
                            </div>
                        )}

                        <form className="auth-form" onSubmit={handleVerifyOtpSubmit}>
                            <div className="input-group">
                                <label htmlFor="otp">Enter 6-Digit OTP Code</label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    id="otp"
                                    name="otp"
                                    maxLength="6"
                                    placeholder="e.g. 849201"
                                    style={{ letterSpacing: '4px', fontSize: '1.2rem', textAlign: 'center', fontWeight: 'bold' }}
                                    required
                                />
                            </div>

                            <button type="submit" className="button primary-btn">
                                Verify & Create Account
                            </button>
                        </form>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                style={{ background: 'none', border: 'none', color: '#8f9cae', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                ← Change Email
                            </button>
                            <button
                                type="button"
                                onClick={handleResend}
                                style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontWeight: '600' }}
                            >
                                Resend OTP
                            </button>
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}

export default Register
