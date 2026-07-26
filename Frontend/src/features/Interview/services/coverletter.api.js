import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://resume-generator-production-2eae.up.railway.app";

const api = axios.create({
    baseURL: API_BASE_URL.replace(/\/$/, ""),
    withCredentials: true
});

export async function generateCoverLetterFromReport(interviewReportId, { companyName, roleName } = {}) {
    const response = await api.post(`/api/cover-letter/generate-from-report/${interviewReportId}`, {
        companyName,
        roleName
    });
    return response.data;
}

export async function getCoverLetterByReportId(interviewReportId) {
    const response = await api.get(`/api/cover-letter/report/${interviewReportId}`);
    return response.data;
}

export async function getCoverLetterById(coverLetterId) {
    const response = await api.get(`/api/cover-letter/${coverLetterId}`);
    return response.data;
}

export async function getAllCoverLetters() {
    const response = await api.get('/api/cover-letter');
    return response.data;
}

export async function generateCoverLetterPdf(coverLetterId) {
    let response;
    try {
        response = await api.post(`/api/cover-letter/pdf/${coverLetterId}`, null, {
            responseType: 'blob'
        });
    } catch (error) {
        const responseData = error?.response?.data;

        // When responseType is 'blob', error data is also a Blob — read it as text
        if (responseData instanceof Blob) {
            const text = await responseData.text();
            let message = 'Failed to generate cover letter PDF.';
            try {
                const parsedError = JSON.parse(text);
                message = parsedError?.message || message;
            } catch {
                message = text || message;
            }
            throw new Error(message);
        }
        throw error;
    }

    const blob = response.data;

    if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error('Cover letter PDF response is not a valid PDF blob.');
    }

    // Ensure the blob has the correct PDF MIME type
    if (blob.type !== 'application/pdf') {
        return new Blob([blob], { type: 'application/pdf' });
    }

    return blob;
}

export async function deleteCoverLetter(coverLetterId) {
    const response = await api.delete(`/api/cover-letter/${coverLetterId}`);
    return response.data;
}

export async function updateCoverLetter(coverLetterId, { generatedContent }) {
    const response = await api.put(`/api/cover-letter/${coverLetterId}`, { generatedContent });
    return response.data;
}
