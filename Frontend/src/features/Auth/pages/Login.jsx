import React from 'react'
import { useState } from 'react'
import '../auth.form.scss'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import Home from './Home'

const Login = () => {

    const navigate = useNavigate()

    const { loading, handleLogin } = useAuth()
    
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const handelSubmit = async (e) => {
        e.preventDefault()
        await handleLogin({ email, password })
        navigate('/')
    }

    if (loading) {
        return (<main>
            <h1>Loading....</h1>
        </main>)
    }

    return (
        <main>
            <div className="form-container">
                <h1>Login</h1>
                <form className="auth-form" onSubmit={handelSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input type="email" id="email"
                            onChange={(e)=>{setEmail(e.target.value)}}
                            name="email" placeholder="Enter your email..." />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password"
                            onChange={(e)=>{setPassword(e.target.value)}}
                            name="password" placeholder="Enter your password..." />
                    </div>
                    <button type="submit" className="button primary-btn" >Login</button>
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