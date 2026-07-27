import { useContext } from 'react';
import { AuthContext } from '../auth.context';
import { login, register, verifyOtp, resendOtp, logout } from '../services/auth.api';

export const useAuth = () => {
    const context = useContext(AuthContext)
    const { user, setUser, loading, setLoading } = context

    const handleLogin = async ({ email, password }) => {
        setLoading(true)
        try {
            const data = await login({ email, password })
            setUser(data?.user || null)
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

    const handleLogout = async () => {
        setLoading(true)
        try {
            await logout()
            setUser(null)
        } catch (error) {
            throw error
        } finally {
            setLoading(false)
        }
    }

    return { 
        user, 
        loading, 
        handleLogin, 
        handleRegister, 
        handleVerifyOtp, 
        handleResendOtp, 
        handleLogout 
    }
}
