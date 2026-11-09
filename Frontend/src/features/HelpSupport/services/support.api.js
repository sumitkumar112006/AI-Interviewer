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

/**
 * Retrieve authenticated candidate's support tickets
 */
export async function getMySupportTickets(params = {}) {
    const response = await api.get('my-tickets', { params });
    return response.data;
}

/**
 * Retrieve specific ticket details & conversation thread
 */
export async function getMySupportTicketDetails(ticketId) {
    const response = await api.get(`my-tickets/${ticketId}`);
    return response.data;
}

/**
 * Post a customer reply to an existing support ticket
 */
export async function replyMySupportTicket(ticketId, message) {
    const response = await api.post(`my-tickets/${ticketId}/reply`, { message });
    return response.data;
}
