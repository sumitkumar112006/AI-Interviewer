import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://kivi-ai-production.up.railway.app";
const api = axios.create({
    baseURL: `${API_BASE_URL.replace(/\/$/, "")}/api/admin/`,
    withCredentials: true
});

export async function getAdminStats() {
    const response = await api.get('stats');
    return response.data;
}

export async function getAdminUsers(params = {}) {
    const response = await api.get('users', { params });
    return response.data;
}

export async function updateUserRole(userId, role) {
    const response = await api.patch(`users/${userId}/role`, { role });
    return response.data;
}

export async function updateUserPlan(userId, plan) {
    const response = await api.patch(`users/${userId}/plan`, { plan });
    return response.data;
}

export async function toggleUserBlock(userId, isBlocked) {
    const response = await api.patch(`users/${userId}/block`, { isBlocked });
    return response.data;
}

export async function deleteUser(userId) {
    const response = await api.delete(`users/${userId}`);
    return response.data;
}

export async function grantUserCredits(identifier, bonusCredits) {
    const response = await api.post('users/credits', { identifier, bonusCredits });
    return response.data;
}

export async function createAdminAccount({ username, email, password, role }) {
    const response = await api.post('create-admin', { username, email, password, role });
    return response.data;
}

export async function updateUserFeatureAccess(userId, blockedFeatures) {
    const response = await api.patch(`users/${userId}/feature-access`, { blockedFeatures });
    return response.data;
}

export async function getUserById(userId) {
    const response = await api.get(`users/${userId}`);
    return response.data;
}

export async function adjustUserCredits(userId, payload) {
    const body = typeof payload === 'object' ? payload : { action: arguments[1], amount: arguments[2] };
    const response = await api.post(`users/${userId}/credits`, body);
    return response.data;
}

export async function sendAdminMessage({ targetType, targetValue, title, message }) {
    const response = await api.post('broadcast-message', { targetType, targetValue, title, message });
    return response.data;
}

export async function getAdminPayments(params = {}) {
    const response = await api.get('payments', { params });
    return response.data;
}

export async function getAdminSubscriptions(params = {}) {
    const response = await api.get('subscriptions', { params });
    return response.data;
}

export async function getAdminAuditLogs(params = {}) {
    const response = await api.get('audit-logs', { params });
    return response.data;
}

export async function getAdminInvoices(params = {}) {
    const response = await api.get('invoices', { params });
    return response.data;
}
