import { createContext, useState } from 'react'

export const AuthProvider = createContext()

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [Loading, setLoading] = useState(false)

    return (
        <AuthProvider.Provider value={{user, setUser, Loading, setLoading}}>
            {children}
        </AuthProvider.Provider>
    )


}