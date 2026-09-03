import { useContext } from 'react';
import { AuthContext } from '../auth.context';
import { supabase } from '../services/supabase';
import { login, register, verifyOtp, resendOtp, logout, forgotPassword, resetPassword, loginWithGoogleSupabase } from '../services/auth.api';

export const useAuth = () => {
    const context = useContext(AuthContext)
    const { user, setUser, loading, setLoading, usage, setUsage, fetchUsage } = context

    const handleGoogleAuth = async ({ accessToken }) => {
        setLoading(true)
        try {
            const data = await loginWithGoogleSupabase({ accessToken })
            setUser(data?.user || null)
            if (fetchUsage) await fetchUsage()
            return data
        } catch (error) {
            setUser(null)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleLogin = async ({ email, password }) => {
        setLoading(true)
        try {
            const data = await login({ email, password })
            setUser(data?.user || null)
            if (fetchUsage) await fetchUsage()
            return data
        } catch (error) {
            setUser(null)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async ({ username, email, password }) => {
        setLoading(true)
        try {
            const data = await register({ username, email, password })
            return data
        } catch (error) {
            setUser(null)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOtp = async ({ email, otp }) => {
        setLoading(true)
        try {
            const data = await verifyOtp({ email, otp })
            setUser(data?.user || null)
            if (fetchUsage) await fetchUsage()
            return data
        } catch (error) {
            setUser(null)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleResendOtp = async ({ email }) => {
        setLoading(true)
        try {
            const data = await resendOtp({ email })
            return data
        } catch (error) {
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleForgotPassword = async ({ email }) => {
        setLoading(true)
        try {
            const data = await forgotPassword({ email })
            return data
        } catch (error) {
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleResetPassword = async ({ email, otp, newPassword }) => {
        setLoading(true)
        try {
            const data = await resetPassword({ email, otp, newPassword })
            return data
        } catch (error) {
            throw error
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        setLoading(true)
        try {
            if (supabase) {
                try {
                    await supabase.auth.signOut()
                } catch (sbErr) {
                    console.warn("Supabase signOut error:", sbErr)
                }
            }
            await logout()
            setUser(null)
            if (setUsage) setUsage(null)
        } catch (error) {
            throw error
        } finally {
            setLoading(false)
        }
    }

    return { 
        user, 
        setUser,
        loading, 
        setLoading,
        usage, 
        setUsage, 
        fetchUsage, 
        handleGoogleAuth,
        handleLogin, 
        handleRegister, 
        handleVerifyOtp, 
        handleResendOtp, 
        handleForgotPassword, 
        handleResetPassword, 
        handleLogout 
    }
}
