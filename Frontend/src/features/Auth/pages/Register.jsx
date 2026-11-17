import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { SmokeyBackground } from '@/components/ui/login-form';
import SplashCursor from '@/components/SplashCursor';
import { RegisterForm } from '@/components/ui/register-form';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export const Register = () => {
    const navigate = useNavigate();
    const { loading, handleRegister, handleVerifyOtp, handleResendOtp } = useAuth();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const [step, setStep] = useState(1); // 1: Register, 2: OTP Verification
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [validationError, setValidationError] = useState('');

    const usernameValid = username.trim().length >= 2;
    const emailValid = email.trim().length > 0 && email.includes('@');
    const passwordValid = password.length >= 6;
    const confirmValid = confirmPassword.length >= 1 && confirmPassword === password;

    /* ── Step 1: Register submit ── */
    const handleRegisterSubmit = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setInfoMessage('');
        setValidationError('');

        if (!usernameValid || !emailValid || !passwordValid || !confirmPassword) {
            setValidationError('Please complete all fields before submitting.');
            return;
        }

        if (password !== confirmPassword) {
            setValidationError('Passwords do not match. Please verify.');
            return;
        }

        if (!agreedToTerms) {
            setValidationError('Please agree to the Terms of Service and Privacy Policy.');
            return;
        }

        try {
            const data = await handleRegister({ username, email, password });
            setInfoMessage(data?.message || 'Registration initiated! Check your email for the verification code.');
            setOtp('');
            setStep(2);
        } catch (err) {
            console.error('Registration error:', err);
            setError(err?.response?.data?.message || err?.message || 'Registration failed. Please try again.');
        }
    };

    /* ── Step 2: OTP verify ── */
    const handleVerifyOtpSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await handleVerifyOtp({ email, otp });
            sessionStorage.setItem('kivi_just_registered', 'true');
            navigate('/');
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

    /* ── Google OAuth Sign-Up ── */
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
            console.error('Google sign-up error:', err);
            setError(err?.message || 'Google sign up failed. Please try again.');
        }
    };

    return (
        <main
            className="relative w-screen h-screen min-h-screen bg-gray-900 overflow-hidden flex items-center justify-center"
            style={{ width: '100vw', height: '100vh', minHeight: '100vh' }}
        >
            {/* Interactive WebGL Shader Background */}
            <SmokeyBackground className="absolute inset-0" color="#1E40AF" backdropBlurAmount="none" />
            <SplashCursor />

            <div
                className="relative z-10 flex items-center justify-center w-full h-full p-4"
                style={{ width: '100%', height: '100%', minHeight: '100vh' }}
            >
                {/* Step 1: Main Glassmorphism Register Form */}
                {step === 1 && (
                    <RegisterForm
                        username={username}
                        setUsername={(val) => { setUsername(val); setValidationError(''); }}
                        email={email}
                        setEmail={(val) => { setEmail(val); setValidationError(''); }}
                        password={password}
                        setPassword={(val) => { setPassword(val); setValidationError(''); }}
                        confirmPassword={confirmPassword}
                        setConfirmPassword={(val) => { setConfirmPassword(val); setValidationError(''); }}
                        agreedToTerms={agreedToTerms}
                        setAgreedToTerms={(val) => { setAgreedToTerms(val); setValidationError(''); }}
                        onSubmit={handleRegisterSubmit}
                        onGoogleSignUp={handleGoogleAuth}
                        onSignIn={() => navigate('/login')}
                        error={error || validationError}
                        infoMessage={infoMessage}
                        loading={loading}
                    />
                )}

                {/* Step 2: Email Verification OTP */}
                {step === 2 && (
                    <div className="login-card-container w-full max-w-[420px] p-8 space-y-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl relative z-20 text-white">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold tracking-tight">Verify Your Email</h2>
                            <p className="mt-2 text-xs text-gray-300">
                                Verification code sent to <strong className="text-white">{email}</strong>
                            </p>
                        </div>

                        {infoMessage && <div className="p-3 text-xs rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-200">{infoMessage}</div>}
                        {error && (
                            <div className="p-3 text-xs rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleVerifyOtpSubmit}>
                            <div className="relative z-0">
                                <input
                                    type="text"
                                    id="reg_otp_code"
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
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Verifying...
                                    </span>
                                ) : (
                                    'Verify & Create Account'
                                )}
                            </button>
                        </form>

                        <div className="flex items-center justify-between text-xs text-gray-300 pt-2">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(''); }}
                                className="flex items-center gap-1 hover:text-white cursor-pointer"
                            >
                                <ArrowLeft size={14} /> Back to Register
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
            </div>
        </main>
    );
};

export default Register;
