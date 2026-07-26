import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://resume-generator-production-2eae.up.railway.app";

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

export const generateResumePdf = async (interviewReportId, htmlContent = null) => {
    let response

    try {
        response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`, { htmlContent }, {
            responseType: 'blob'
        })
    } catch (error) {
        const responseData = error?.response?.data

        // When responseType is 'blob', error data is also a Blob — read it as text
        if (responseData instanceof Blob) {
            const text = await responseData.text()

            let message = 'Failed to generate resume PDF.'

            try {
                const parsedError = JSON.parse(text)
                message = parsedError?.message || message
            } catch {
                message = text || message
            }

            throw new Error(message)
        }

        throw error
    }

    const blob = response.data

    if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('Resume preview response is not a valid PDF blob.')
    }

    // Ensure the blob has the correct PDF MIME type
    if (blob.type !== 'application/pdf') {
        return new Blob([blob], { type: 'application/pdf' })
    }

    return blob
}

export async function deleteReportById(interviewReportId) {
    const response = await api.delete(`/api/interview/${interviewReportId}`)
    return response.data
}

export async function updateResumeHtml(interviewReportId, { generatedResumeHtml }) {
    const response = await api.put(`/api/interview/resume/${interviewReportId}`, { generatedResumeHtml })
    return response.data
}