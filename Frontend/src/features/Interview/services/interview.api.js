import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://ai-interviewer-kzwc.onrender.com";

const api = axios.create({
    baseURL: API_BASE_URL.replace(/\/$/, ""),
    withCredentials: true
})




export async function getInterviewReportById(interviewId) {
    const response = await api.get(`/api/interview/report/${interviewId}`)
    return response.data
}


export async function getAllInterviewReport() {
    const response = await api.get(`/api/interview`)
    return response.data
}


export const generateInterviewReport = async ({ jobDescription, selfDescription, resumeFile }) => {
    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription)
    formData.append("resume", resumeFile)

    const response = await api.post("/api/interview", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    })

    return response.data
}

/**
 * @description Serbvices to generate resume pdf based on user self description resumr content
 */

export const generateResumePdf = async (interviewReportId) => {
    const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`, null, {
        responseType: 'arraybuffer'
    })

    return new Blob([response.data], { type: 'application/pdf' })
}
