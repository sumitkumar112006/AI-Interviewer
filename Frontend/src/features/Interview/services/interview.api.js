import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://kivi-ai-production.up.railway.app";

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


export async function getJobStatus(jobId) {
    const response = await api.get(`/api/jobs/${jobId}`)
    return response.data
}

export async function getActiveJob(params = {}) {
    const response = await api.get(`/api/jobs/active`, { params })
    return response.data
}

/**
 * Polls background BullMQ generation job until status is 'done' or 'failed'
 */
export async function pollJobUntilComplete(jobId, onProgress = null, intervalMs = 2500) {
    return new Promise((resolve, reject) => {
        let isPolling = true;

        const check = async () => {
            if (!isPolling) return;
            try {
                const jobData = await getJobStatus(jobId);
                if (onProgress && typeof onProgress === 'function') {
                    onProgress(jobData);
                }

                if (jobData.status === 'done') {
                    isPolling = false;
                    resolve(jobData.result);
                } else if (jobData.status === 'failed') {
                    isPolling = false;
                    reject(new Error(jobData.error || 'AI generation failed.'));
                } else {
                    setTimeout(check, intervalMs);
                }
            } catch (err) {
                if (err?.response?.status === 404) {
                    isPolling = false;
                    reject(new Error('Generation job not found.'));
                } else {
                    setTimeout(check, intervalMs);
                }
            }
        };

        check();
    });
}

export const generateInterviewReport = async ({ jobDescription, selfDescription, resumeFile, onProgress }) => {
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

    if (response.data?.jobId) {
        const result = await pollJobUntilComplete(response.data.jobId, onProgress);
        return {
            ...response.data,
            interviewReport: result
        };
    }

    return response.data
}

/**
 * Ensures the resume HTML is generated on the backend.
 * If the report already has HTML, returns immediately.
 * If not, triggers async AI generation job, polls until complete, and returns the updated report.
 */
export const generateResumePdf = async (interviewReportId, options = {}, onProgress = null) => {
    const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`, options)

    if (response.data?.jobId) {
        const result = await pollJobUntilComplete(response.data.jobId, onProgress);
        return {
            ...response.data,
            interviewReport: result
        };
    }

    return response.data
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

export async function rewriteResumeSection({ selectedText, instruction, action, message, resourceId, onProgress }) {
    const response = await api.post(`/api/interview/resume/rewrite-section`, { selectedText, instruction, action, message, resourceId })

    if (response.data?.jobId) {
        const result = await pollJobUntilComplete(response.data.jobId, onProgress);
        return {
            ...response.data,
            replyText: result.replyText,
            suggestedSnippet: result.suggestedSnippet,
            rewrittenText: result.suggestedSnippet
        };
    }

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