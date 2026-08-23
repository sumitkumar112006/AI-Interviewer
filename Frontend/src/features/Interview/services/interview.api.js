import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://resume-generator-production-2eae.up.railway.app";

const api = axios.create({
    baseURL: API_BASE_URL.replace(/\/$/, ""),
    withCredentials: true
})

api.interceptors.response.use(
    response => response,
    error => {
        const status = error?.response?.status;
        let msg = error?.response?.data?.message || error?.message || '';

        const isValidationErr = status === 422 || msg.includes('validation') || msg.includes('required') || msg.includes('too_small') || msg.trim().startsWith('[');
        const isLlmBusy = status === 503 || msg.includes('high demand') || msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED');

        if (isValidationErr || isLlmBusy) {
            const cleanMessage = isLlmBusy
                ? "AI service is currently experiencing high demand. Please try again in a few seconds."
                : "The AI response was not structured properly. Please click 'Generate' again.";
            
            const title = isLlmBusy ? "AI Service Busy" : "Generation Failed";

            if (typeof window !== 'undefined' && window.triggerGlobalError) {
                window.triggerGlobalError(cleanMessage, error?.stack || '', true, title);
            }
        }
        return Promise.reject(error);
    }
);




export async function getInterviewReportById(interviewId) {
    const response = await api.get(`/api/interview/report/${interviewId}`)
    return response.data
}


export async function getAllInterviewReport() {
    const response = await api.get(`/api/interview`)
    return response.data
}

export async function getSkillAnalytics() {
    const response = await api.get(`/api/interview/skill-analytics`)
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
 * Ensures the resume HTML is generated on the backend.
 * If the report already has HTML, returns immediately.
 * If not, triggers AI generation, saves it, and returns the report.
 * PDF is now generated client-side via window.print().
 */
export const generateResumePdf = async (interviewReportId) => {
    const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`)
    return response.data?.interviewReport || response.data
}

export async function deleteReportById(interviewReportId) {
    const response = await api.delete(`/api/interview/${interviewReportId}`)
    return response.data
}

export async function updateResumeHtml(interviewReportId, { generatedResumeHtml }) {
    const response = await api.put(`/api/interview/resume/${interviewReportId}`, { generatedResumeHtml })
    return response.data
}

export async function updateInterviewProgress(interviewId, { technicalQuestions, behavioralQuestion, completedTasks }) {
    const response = await api.put(`/api/interview/progress/${interviewId}`, { technicalQuestions, behavioralQuestion, completedTasks })
    return response.data
}

export async function rewriteResumeSection({ selectedText, instruction, action, message }) {
    const response = await api.post(`/api/interview/resume/rewrite-section`, { selectedText, instruction, action, message })
    return response.data
}

export async function getAiModelInfo() {
    try {
        const response = await api.get(`/api/interview/model-info`)
        return response.data
    } catch (err) {
        return {
            provider: "Groq AI",
            primaryModel: "GPT-OSS 120B",
            fallbackModel: "Gemini 2.5 Flash",
            status: "online",
            label: "GPT-OSS 120B · Groq AI"
        }
    }
}