import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://kivi-ai-production.up.railway.app";
const api = axios.create({
    baseURL: `${API_BASE_URL.replace(/\/$/, "")}/api/support/`,
    withCredentials: true
});

/**
 * Submit general contact inquiry to KIVI backend
 */
export async function submitContactForm({ name, email, category, message }) {
    const response = await api.post('contact', {
        name,
        email,
        category,
        message
    });
    return response.data;
}

/**
 * Submit support ticket to KIVI backend
 * Note: Sensitive user identifiers like database _id or plan are omitted.
 */
export async function submitSupportTicket({ name, email, category, priority, subject, message }) {
    const response = await api.post('ticket', {
        name,
        email,
        category,
        priority,
        subject,
        message
    });
    return response.data;
}

/**
 * Submit newsletter subscription to KIVI backend
 * Does not store emails in browser storage.
 */
export async function subscribeNewsletter({ email }) {
    const response = await api.post('newsletter', { email });
    return response.data;
}
