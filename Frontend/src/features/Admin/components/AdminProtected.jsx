import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../Auth/hooks/useAuth';
import { getMe } from '../../Auth/services/auth.api';

export default function AdminProtected({ children }) {
    const { user, setUser, loading } = useAuth();
    const [checkingFreshRole, setCheckingFreshRole] = useState(true);
    const [freshRole, setFreshRole] = useState(user?.role || null);

    useEffect(() => {
        let mounted = true;
        const checkRole = async () => {
            try {
                const data = await getMe();
                if (mounted && data?.user) {
                    setUser(data.user);
                    setFreshRole(data.user.role);
                }
            } catch (err) {
                console.error("Admin role check error:", err);
            } finally {
                if (mounted) setCheckingFreshRole(false);
            }
        };

        checkRole();
        return () => { mounted = false; };
    }, [setUser]);

    if (loading || checkingFreshRole) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#090d16',
                color: '#6366f1',
                fontSize: '1.2rem',
                fontWeight: 600
            }}>
                Verifying Administrator Permissions...
            </div>
        );
    }

    const isAdmin = user?.isAdmin || freshRole === 'admin' || freshRole === 'super_admin' || user?.role === 'admin' || user?.role === 'super_admin';

    if (!user || !isAdmin) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#090d16',
                color: '#f87171',
                padding: '2rem',
                textAlign: 'center',
                fontFamily: 'system-ui, sans-serif'
            }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                <h1 style={{ color: '#ffffff', fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>Admin Access Required</h1>
                <p style={{ color: '#94a3b8', maxWidth: '480px', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                    Logged in as <strong style={{ color: '#ffffff' }}>{user?.email || 'Guest'}</strong> (Role: <span style={{ color: '#f87171' }}>{freshRole || user?.role || 'user'}</span>).
                    This account does not have Admin privileges.
                </p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link to="/admin-login-secret" style={{
                        backgroundColor: '#6366f1',
                        color: '#ffffff',
                        padding: '0.6rem 1.2rem',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: 700
                    }}>
                        Log in as Admin
                    </Link>
                    <Link to="/" style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        color: '#cbd5e1',
                        padding: '0.6rem 1.2rem',
                        borderRadius: '8px',
                        textDecoration: 'none'
                    }}>
                        Back to App
                    </Link>
                </div>
            </div>
        );
    }

    return children;
}
