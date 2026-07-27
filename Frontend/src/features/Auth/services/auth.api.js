import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://resume-generator-production-2eae.up.railway.app";
const api = axios.create({
    baseURL: `${API_BASE_URL.replace(/\/$/, "")}/api/auth/`,
    withCredentials: true
})


export async function register({ username, email, password }) {
    try {
        const response = await api.post('register', {
            username, email, password
        })
        return response.data
    } catch (err) {
        throw err;
    }
}

export async function verifyOtp({ email, otp }) {
    try {
        const response = await api.post('verify-otp', {
            email, otp
        })
        return response.data
    } catch (err) {
        throw err;
    }
}

export async function resendOtp({ email }) {
    try {
        const response = await api.post('resend-otp', {
            email
        })
        return response.data
    } catch (err) {
        throw err;
    }
}

export async function login({ email, password }) {
    try {
        const response = await api.post('login', {
            email, password
        }, {
            withCredentials: true
        })
        return response.data
    } catch (err) {
        throw err;
    }
}


export async function logout() {
    try {
        const response = await api.get('logout');
        return response.data
    } catch (err) {
        throw err;
    }
}


export async function getMe() {
    try {
        const response = await api.get('get-me')
        return response.data
    } catch (err) {
        if (err?.response?.status === 401) {
            return { user: null }
        }
        throw err;
    }
}
