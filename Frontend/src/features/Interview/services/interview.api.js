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

export const generateInterviewReport = async ({ jobDescription, selfDescription, resumeFile, saveSelfDescription = false, onProgress }) => {
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
    if (saveSelfDescription) {
        formData.append("saveSelfDescription", "true")
    }

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
    try {
        const response = await api.post(`/api/interview/resume/pdf/${interviewReportId}`, options)

        if (response.data?.jobId) {
            const result = await pollJobUntilComplete(response.data.jobId, onProgress);
            return {
                ...response.data,
                interviewReport: result
            };
        }

        return response.data
    } catch (err) {
        // If a generation job is already running (409 Conflict), seamlessly poll the existing job
        if (err?.response?.status === 409 && err?.response?.data?.jobId) {
            const result = await pollJobUntilComplete(err.response.data.jobId, onProgress);
            return {
                ...err.response.data,
                interviewReport: result
            };
        }
        throw err;
    }
}

export async function deleteReportById(interviewReportId) {
    const response = await api.delete(`/api/interview/${interviewReportId}`)
    return response.data
}

export async function updateResumeHtml(interviewReportId, payload) {
    const generatedResumeHtml = typeof payload === 'string'
        ? payload
        : (payload?.generatedResumeHtml ?? '');

    const clean = (generatedResumeHtml || '').replace(/<[^>]*>/g, '').trim();
    if (/^[a-f0-9]{24}$/i.test(clean) || clean.length < 30) {
        console.warn('[updateResumeHtml] Attempted to send invalid or ObjectId resume HTML. Request blocked.', { interviewReportId, clean });
        throw new Error('Invalid resume content: cannot save empty text or system IDs.');
    }

    const response = await api.put(`/api/interview/resume/${interviewReportId}`, { generatedResumeHtml })
    return response.data
}

export async function updateInterviewProgress(interviewId, { technicalQuestions, behavioralQuestion, completedTasks }) {
    const response = await api.put(`/api/interview/progress/${interviewId}`, { technicalQuestions, behavioralQuestion, completedTasks })
    return response.data
}

export async function rewriteResumeSection({ selectedText, instruction, action, message, resourceId, currentResumeHtml, onProgress }) {
    const response = await api.post(`/api/interview/resume/rewrite-section`, {
        selectedText,
        instruction,
        action,
        message,
        resourceId,
        currentResumeHtml
    })

    if (response.data?.jobId) {
        const result = await pollJobUntilComplete(response.data.jobId, onProgress);
        return {
            ...response.data,
            replyText: result.replyText,
            targetText: result.targetText || selectedText || null,
            suggestedSnippet: result.suggestedSnippet,
            rewrittenText: result.suggestedSnippet
        };
    }

    return response.data
}

export async function streamAssistantChatApi({
    reportId = null,
    message = '',
    selectedText = '',
    action = 'enhance',
    instruction = '',
    activeTab = '',
    currentRoute = '',
    onToken = () => {},
    onDone = () => {},
    onError = () => {},
    signal = null
}) {
    const baseUrl = API_BASE_URL.replace(/\/$/, "");
    const url = `${baseUrl}/api/assistant/chat`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            credentials: 'include',
            body: JSON.stringify({
                reportId,
                message,
                selectedText,
                action,
                instruction,
                activeTab,
                currentRoute,
                stream: true
            }),
            signal
        });

        if (!response.ok) {
            let errorMsg = `Server error (${response.status})`;
            try {
                const errJson = await response.json();
                errorMsg = errJson.message || errorMsg;
            } catch (e) {
                // ignore
            }
            const err = new Error(errorMsg);
            err.status = response.status;
            throw err;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulatedText = '';
        let buffer = '';
        let doneData = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // keep remaining incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':')) continue; // skip comments / pings

                if (trimmed === 'data: [DONE]') {
                    continue;
                }

                if (trimmed.startsWith('data: ')) {
                    const jsonStr = trimmed.slice(6);
                    try {
                        const parsed = JSON.parse(jsonStr);
                        if (parsed.type === 'token' && parsed.token) {
                            accumulatedText += parsed.token;
                            onToken(parsed.token, accumulatedText);
                        } else if (parsed.type === 'done') {
                            doneData = parsed;
                        } else if (parsed.type === 'error') {
                            throw new Error(parsed.message || 'Stream error occurred.');
                        }
                    } catch (parseErr) {
                        // ignore malformed SSE json chunks
                    }
                }
            }
        }

        const finalResult = {
            replyText: doneData?.reply || accumulatedText,
            targetText: doneData?.targetText || selectedText || null,
            suggestedSnippet: doneData?.suggestedSnippet || null,
            resources: doneData?.resources || [],
            profile: doneData?.profile || null
        };

        onDone(finalResult);
        return finalResult;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log('[SSE] Stream aborted by client.');
            return null;
        }
        onError(err);
        throw err;
    }
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

export async function getAssistantHistoryApi() {
    try {
        const response = await api.get('/api/assistant/history');
        return response.data;
    } catch (err) {
        console.warn('Failed to fetch assistant history:', err);
        return { history: [] };
    }
}

export async function clearAssistantHistoryApi() {
    try {
        const response = await api.delete('/api/assistant/history');
        return response.data;
    } catch (err) {
        console.warn('Failed to clear assistant history:', err);
        return { message: 'Failed to clear history' };
    }
}