import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { SmokeyBackground, LoginForm } from '@/components/ui/login-form';
import SplashCursor from '@/components/SplashCursor';
import { ArrowRight, ArrowLeft, Loader2, KeyRound, Mail, AlertCircle } from 'lucide-react';

export const Login = () => {
    const navigate = useNavigate();
    const {
        loading,
        handleLogin,
        handleVerifyOtp,
        handleResendOtp,
        handleForgotPassword,
        handleResetPassword
    } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [validationError, setValidationError] = useState('');

    const [step, setStep] = useState(1); // 1: Login, 2: Login OTP, 3: Forgot Pass Email, 4: Reset Pass OTP & New Pass
    const [otp, setOtp] = useState('');

    const emailValid = email.trim().length > 0 && email.includes('@');
    const passwordValid = password.length >= 1;
    const newPasswordValid = newPassword.length >= 6;

    /* ── Step 1: Login submit ── */
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setInfoMessage('');
        setValidationError('');

        if (!emailValid || !passwordValid) {
            setValidationError('Please fill in both email and password.');
            return;
        }

        try {
            const loginRes = await handleLogin({ email, password });
            if (loginRes?.user?.isAdmin || ['admin', 'super_admin'].includes(loginRes?.user?.role)) {
                navigate('/admin-portal-dashboard-root');
            } else {
                navigate('/');
            }
        } catch (err) {
            console.error('Login error:', err);
            if (err?.response?.status === 403 && err?.response?.data?.requiresOtp) {
                const data = err.response.data;
                setInfoMessage(data.message || 'Your email is not verified. A code has been sent to your inbox.');
                setOtp('');
                setStep(2);
            } else {
                setError(err?.response?.data?.message || err?.message || 'Login failed. Please check your credentials.');
            }
        }
    };

    /* ── Google OAuth ── */
    const handleGoogleAuth = async () => {
        if (!isSupabaseConfigured()) {
            setError('Supabase authentication is not configured.');
            return;
        }

        try {
            setError('');
            const callbackUrl = `${window.location.origin}/auth/callback`;
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: callbackUrl,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent'
                    }
                }
            });
            if (oauthError) throw oauthError;
        } catch (err) {
            console.error('Google login error:', err);
            setError(err?.message || 'Google sign in failed. Please try again.');
        }
    };

    /* ── Step 2: OTP verify ── */
    const handleVerifyOtpSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const verifyRes = await handleVerifyOtp({ email, otp });
            if (verifyRes?.user?.isAdmin || ['admin', 'super_admin'].includes(verifyRes?.user?.role)) {
                navigate('/admin-portal-dashboard-root');
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || 'Invalid OTP code.');
        }
    };

    const handleResend = async () => {
        setError('');
        setInfoMessage('');
        try {
            const res = await handleResendOtp({ email });
            setInfoMessage(res?.message || 'Verification code resent to your email.');
            setOtp('');
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to resend OTP.');
        }
    };

    /* ── Step 3: Request Forgot Password OTP ── */
    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfoMessage('');
        setValidationError('');

        if (!emailValid) {
            setValidationError('Please enter a valid email address.');
            return;
        }

        try {
            const res = await handleForgotPassword({ email });
            setInfoMessage(res?.message || 'Reset code sent! Please check your inbox.');
            setOtp('');
            setStep(4);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to send reset code. Please try again.');
        }
    };

    /* ── Step 4: Reset Password Submit ── */
    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfoMessage('');

        if (otp.length < 6) {
            setError('Please enter the full 6-digit OTP code.');
            return;
        }

        if (!newPasswordValid) {
            setError('New password must be at least 6 characters long.');
            return;
        }

        try {
            const res = await handleResetPassword({ email, otp, newPassword });
            setInfoMessage(res?.message || 'Password reset successfully! Please log in.');
            setPassword('');
            setNewPassword('');
            setOtp('');
            setStep(1);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to reset password. Please check your code.');
        }
    };

    return (
        <main
            className="relative w-screen h-screen min-h-screen bg-gray-900 overflow-hidden flex items-center justify-center"
            style={{ width: '100vw', height: '100vh', minHeight: '100vh' }}
        >
            {/* Interactive WebGL Shader Background */}
            <SmokeyBackground className="absolute inset-0" color="#1E40AF" backdropBlurAmount="sm" />
            <SplashCursor />

            <div
                className="relative z-10 flex items-center justify-center w-full h-full p-4"
                style={{ width: '100%', height: '100%', minHeight: '100vh' }}
            >
                {/* Step 1: Main Glassmorphism Login Form */}
                {step === 1 && (
                    <LoginForm
                        email={email}
                        setEmail={(val) => { setEmail(val); setValidationError(''); }}
                        password={password}
                        setPassword={(val) => { setPassword(val); setValidationError(''); }}
                        onSubmit={handleSubmit}
                        onGoogleLogin={handleGoogleAuth}
                        onForgotPassword={() => {
                            setStep(3);
                            setError('');
                            setInfoMessage('');
                            setValidationError('');
                        }}
                        onSignUp={() => navigate('/register')}
                        error={error || validationError}
                        infoMessage={infoMessage}
                        loading={loading}
                    />
                )}

                {/* Step 2: Email Verification OTP */}
                {step === 2 && (
                    <div className="login-card-container w-full max-w-[440px] p-8 space-y-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl relative z-20 text-white">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold tracking-tight">Verify Your Email</h2>
                            <p className="mt-2 text-xs text-gray-300">
                                Verification code sent to <strong className="text-white">{email}</strong>
                            </p>
                        </div>

                        {infoMessage && <div className="p-3 text-xs rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-200">{infoMessage}</div>}
                        {error && <div className="p-3 text-xs rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200">{error}</div>}

                        <form className="space-y-6" onSubmit={handleVerifyOtpSubmit}>
                            <div className="relative z-0">
                                <input
                                    type="text"
                                    id="otp_code"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="block py-2.5 px-0 w-full text-center tracking-widest text-lg font-mono text-white bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:border-blue-500"
                                    placeholder="Enter 6-digit code"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || otp.length < 6}
                                className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition disabled:opacity-50 cursor-pointer"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Continue'}
                            </button>
                        </form>

                        <div className="flex items-center justify-between text-xs text-gray-300 pt-2">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); }}
                                className="flex items-center gap-1 hover:text-white cursor-pointer"
                            >
                                <ArrowLeft size={14} /> Back to Login
                            </button>
                            <button
                                type="button"
                                onClick={handleResend}
                                className="text-blue-400 hover:text-blue-300 cursor-pointer"
                            >
                                Resend code
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Forgot Password Request */}
                {step === 3 && (
                    <div className="login-card-container w-full max-w-[440px] p-8 space-y-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl relative z-20 text-white">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold tracking-tight">Reset Password</h2>
                            <p className="mt-2 text-xs text-gray-300">
                                Enter your account email to receive a recovery code.
                            </p>
                        </div>

                        {infoMessage && <div className="p-3 text-xs rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-200">{infoMessage}</div>}
                        {error && <div className="p-3 text-xs rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200">{error}</div>}
                        {validationError && <div className="p-3 text-xs rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200">{validationError}</div>}

                        <form className="space-y-6" onSubmit={handleForgotPasswordSubmit}>
                            <div className="relative z-0">
                                <input
                                    type="email"
                                    id="reset_email"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setValidationError(''); }}
                                    className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:border-blue-500 peer"
                                    placeholder=" "
                                    required
                                />
                                <label
                                    htmlFor="reset_email"
                                    className="absolute text-sm text-gray-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-blue-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
                                >
                                    <Mail className="inline-block mr-2 -mt-1" size={16} />
                                    Email Address
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition disabled:opacity-50 cursor-pointer"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Recovery Code'}
                            </button>
                        </form>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); setValidationError(''); }}
                                className="text-xs text-gray-300 hover:text-white flex items-center justify-center gap-1 mx-auto cursor-pointer"
                            >
                                <ArrowLeft size={14} /> Back to Login
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Reset Password OTP + New Password */}
                {step === 4 && (
                    <div className="login-card-container w-full max-w-[440px] p-8 space-y-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl relative z-20 text-white">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold tracking-tight">Set New Password</h2>
                            <p className="mt-2 text-xs text-gray-300">
                                Enter the recovery code and your new password.
                            </p>
                        </div>

                        {infoMessage && <div className="p-3 text-xs rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-200">{infoMessage}</div>}
                        {error && <div className="p-3 text-xs rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200">{error}</div>}

                        <form className="space-y-6" onSubmit={handleResetPasswordSubmit}>
                            <div className="relative z-0">
                                <input
                                    type="text"
                                    id="reset_otp"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="block py-2.5 px-0 w-full text-center tracking-widest text-lg font-mono text-white bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:border-blue-500"
                                    placeholder="Enter 6-digit code"
                                    required
                                />
                            </div>

                            <div className="relative z-0">
                                <input
                                    type="password"
                                    id="new_password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:border-blue-500 peer"
                                    placeholder=" "
                                    required
                                />
                                <label
                                    htmlFor="new_password"
                                    className="absolute text-sm text-gray-300 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:left-0 peer-focus:text-blue-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
                                >
                                    <KeyRound className="inline-block mr-2 -mt-1" size={16} />
                                    New Password (min 6 chars)
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || otp.length < 6 || newPassword.length < 6}
                                className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition disabled:opacity-50 cursor-pointer"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password & Log In'}
                            </button>
                        </form>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); }}
                                className="text-xs text-gray-300 hover:text-white flex items-center justify-center gap-1 mx-auto cursor-pointer"
                            >
                                <ArrowLeft size={14} /> Cancel & Back to Login
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
};

export default Login;
