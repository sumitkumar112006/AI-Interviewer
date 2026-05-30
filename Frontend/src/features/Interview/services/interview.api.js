import axios from 'axios'

const api = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true
})

export async function getInterviewReport(interviewId) {
    const response = await api.get(interviewId)
    return response.data
}
