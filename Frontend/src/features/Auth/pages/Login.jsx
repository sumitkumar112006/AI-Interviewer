import React, { useState } from 'react'
import '../auth.form.scss'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoadingPage from '../../Interview/Loading'

const Login = () => {
    const navigate = useNavigate()
    const { loading, handleLogin } = useAuth()
    
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    const handelSubmit = async (e) => {
        e.preventDefault()
        setError("")
        try {
            await handleLogin({ email, password })
            navigate('/')
        } catch (err) {
            console.error('Login error:', err)
            const message = err?.response?.data?.message || err?.message || 'Login failed. Please check your credentials.'
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
                <h1>Login</h1>
                {error && <div className="error-message">{error}</div>}
                <form className="auth-form" onSubmit={handelSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            name="email"
                            placeholder="Enter your email..."
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            name="password"
                            placeholder="Enter your password..."
                            required
                        />
                    </div>
                    <button type="submit" className="button primary-btn">Login</button>
                </form>
                <p>
                    Don't have an Account?
                    <Link to="/register"> Register</Link>
                </p>
            </div>
        </main>
    )
}

export default Login
