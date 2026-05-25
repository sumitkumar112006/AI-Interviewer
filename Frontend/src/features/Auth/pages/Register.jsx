import React, { useState } from 'react'
import {useNavigate, Link, useSearchParams} from 'react-router-dom'

const Register = () => {

    const navigate = useNavigate()

    const [username, setUsername] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const handelSubmit = (e) => {
        e.preventDefault()
    }

    return (
        <main>
            <div className="form-container">
                <h1>Register</h1>
                <form className="auth-form"
                    
                    onSubmit={() => { handelSubmit() }}>
                    
                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input type="text" id="username" name="username" placeholder="Enter your username..." />
                    </div>

                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input type="email" id="email" name="email" placeholder="Enter your email..." />
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password" name="password" placeholder="Enter your password..."/>
                    </div>

                    <button type="submit" className="button primary-btn">
                        Register
                    </button>
                </form>
                <p>
                    Already have an Account?
                    <Link to="/login">Login</Link>
                </p>
            </div>
        </main>
    )
}

export default Register