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
    if (!resumeFile) {
        throw new Error('Resume file is required.')
    }

    if (resumeFile.type && resumeFile.type !== 'application/pdf') {
        throw new Error('Only PDF resume files are supported.')
    }

    if (!jobDescription || !jobDescription.trim()) {
        throw new Error('Job description is required.')
    }

    if (!selfDescription || !selfDescription.trim()) {
        throw new Error('Self description is required.')
    }

    const formData = new FormData()
    formData.append("jobDescription", jobDescription.trim())
    formData.append("selfDescription", selfDescription.trim())
    formData.append("resume", resumeFile)

    const response = await api.post("/api/interview", formData)

    return response.data
}

/**
 * @description Serbvices to generate resume pdf based on user self description resumr content
 */

export const generateResumePdf = async (interviewReportId) => {
    const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`, null, {
        responseType: 'arraybuffer'
    })

    const blob = new Blob([response.data], { type: 'application/pdf' })

    if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('Resume preview response is not a valid PDF blob.')
    }

    return blob
}
