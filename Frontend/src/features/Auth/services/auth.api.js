import axios from 'axios'

const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_BASE_URL}/api/auth/`,
    withCredentials: true
})


export async function register({ username, email, password }) {
    try {
        const response = await api.post('register', {
            username, email, password
        })

        return response.data

    } catch (err) {
        console.log(err);
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
        console.log(err);

    }
}


export async function logout() {
    try {
        const response = await api.get('logout')

        return response.data
    } catch (err) {
        console.log(err);
    }
}


export async function getMe() {
    try {
        const response = await api.get('get-me')

        return response.data
    } catch (err) {
        console.log(err);
    }
}