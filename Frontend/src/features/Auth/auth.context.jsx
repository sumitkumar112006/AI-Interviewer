import { createContext, useEffect, useState, useCallback } from 'react'
import { getMe, getUserUsage } from './services/auth.api'

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [usage, setUsage] = useState(null)

    const fetchUsage = useCallback(async () => {
        try {
            const data = await getUserUsage()
            if (data) {
                setUsage(data)
            }
        } catch (err) {
            console.error("Error fetching usage limits:", err)
        }
    }, [])

    useEffect(() => {
        const bootstrapUser = async () => {
            try {
                const data = await getMe()
                setUser(data?.user || null)
                if (data?.user) {
                    await fetchUsage()
                }
            } catch (error) {
                setUser(null)
                setUsage(null)
            } finally {
                setLoading(false)
            }
        }

        bootstrapUser()
    }, [fetchUsage])

    return (
        <AuthContext.Provider value={{ user, setUser, loading, setLoading, usage, setUsage, fetchUsage }}>
            {children}
        </AuthContext.Provider>
    )


}
