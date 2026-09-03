import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import PageLoading from '../../Shared/components/PageLoading';
import '../styles/auth.scss';

const AuthCallback = () => {
    const navigate = useNavigate();
    const { handleGoogleAuth } = useAuth();
    const [error, setError] = useState(null);
    const hasHandled = useRef(false);

    useEffect(() => {
        if (hasHandled.current) return;
        hasHandled.current = true;

        const processAuth = async () => {
            try {
                if (!supabase) {
                    throw new Error("Supabase client is not configured.");
                }

                // 1. Get current session from Supabase
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) {
                    throw sessionError;
                }

                let accessToken = session?.access_token;

                // If not immediately available in getSession, wait briefly for onAuthStateChange
                if (!accessToken) {
                    const sessionPromise = new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error("Authentication timed out. No active session found."));
                        }, 8000);

                        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
                            if (newSession?.access_token) {
                                clearTimeout(timeout);
                                subscription.unsubscribe();
                                resolve(newSession.access_token);
                            }
                        });
                    });

                    accessToken = await sessionPromise;
                }

                if (!accessToken) {
                    throw new Error("Could not retrieve Google access token.");
                }

                // 2. Send Supabase access token to our backend via useAuth hook
                const backendRes = await handleGoogleAuth({ accessToken });

                if (backendRes?.user) {
                    // Clean navigation to dashboard
                    navigate('/', { replace: true });
                } else {
                    throw new Error("Failed to complete server authentication.");
                }

            } catch (err) {
                console.error("[OAUTH CALLBACK ERROR]", err);
                setError(
                    err?.response?.data?.message ||
                    err?.message ||
                    "An error occurred while completing Google sign-in."
                );
            }
        };

        processAuth();
    }, [navigate, handleGoogleAuth]);

    if (error) {
        return (
            <main className="auth-page-root">
                <div className="auth-card" style={{ textAlign: 'center', gap: '1rem' }}>
                    <div className="auth-header">
                        <h1 style={{ color: '#ef4444', fontSize: '1.4rem' }}>Authentication Error</h1>
                        <p className="auth-subtitle">
                            We couldn't sign you in with Google.
                        </p>
                    </div>

                    <div className="auth-error-msg" style={{ textAlign: 'left' }}>
                        {error}
                    </div>

                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <Link to="/login" className="auth-submit-btn" style={{ textDecoration: 'none', justifyContent: 'center' }}>
                            Return to Sign in
                        </Link>
                        <Link to="/register" className="auth-footer-link" style={{ textAlign: 'center', marginTop: '0.25rem' }}>
                            Create a new account
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="auth-page-root">
            <PageLoading
                title="Completing Google Sign-in..."
                subtitle="Setting up your KIVI-AI workspace session..."
            />
        </main>
    );
};

export default AuthCallback;
