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

export async function downloadAdminInvoiceHtml(invoiceId) {
    const response = await api.get(`invoices/${invoiceId}/pdf`, { responseType: 'blob' });
    return response.data;
}

export async function exportAdminData(moduleName, params = {}) {
    const response = await api.get(`export/${moduleName}`, {
        params,
        responseType: 'blob'
    });
    return response;
}

/**
 * Triggers a browser file download from a response blob
 */
export function triggerBlobDownload(blobData, defaultFilename = 'export.csv') {
    const blob = new Blob([blobData]);
    const fileURL = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = fileURL;
    link.download = defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(fileURL);
}

export async function getAdminJobs(params = {}) {
    const response = await api.get('jobs', { params });
    return response.data;
}

export async function getAdminJobDetails(jobId) {
    const response = await api.get(`jobs/${jobId}`);
    return response.data;
}

export async function retryAdminJob(jobId, reason = '') {
    const response = await api.post(`jobs/${jobId}/retry`, { reason });
    return response.data;
}

export async function cancelAdminJob(jobId, reason = '') {
    const response = await api.post(`jobs/${jobId}/cancel`, { reason });
    return response.data;
}

export async function getAdminSupportTickets(params = {}) {
    const response = await api.get('support/tickets', { params });
    return response.data;
}

export async function getAdminSupportTicketDetails(ticketId) {
    const response = await api.get(`support/tickets/${ticketId}`);
    return response.data;
}

export async function assignAdminSupportTicket(ticketId, assignedAdminId, reason = '') {
    const response = await api.patch(`support/tickets/${ticketId}/assign`, { assignedAdminId, reason });
    return response.data;
}

export async function updateAdminSupportTicketStatus(ticketId, { status, priority, reason = '' }) {
    const response = await api.patch(`support/tickets/${ticketId}/status`, { status, priority, reason });
    return response.data;
}

export async function addAdminSupportTicketNote(ticketId, note) {
    const response = await api.post(`support/tickets/${ticketId}/notes`, { note });
    return response.data;
}

export async function replyAdminSupportTicket(ticketId, { message, status, sendEmail = true }) {
    const response = await api.post(`support/tickets/${ticketId}/reply`, { message, status, sendEmail });
    return response.data;
}

export async function getAdminAtsAnalytics(params = {}) {
    const response = await api.get('analytics/ats', { params });
    return response.data;
}

export async function getAdminAiUsageAnalytics(params = {}) {
    const response = await api.get('analytics/ai-usage', { params });
    return response.data;
}

export async function getAdminAiUsageLogs(params = {}) {
    const response = await api.get('analytics/ai-usage/logs', { params });
    return response.data;
}

export async function getAdminSubscriptionReconciliation() {
    const response = await api.get('subscriptions/reconciliation');
    return response.data;
}

export async function getUserActivityAnalytics(params = {}) {
    const response = await api.get('analytics/user-activity', { params });
    return response.data;
}

export async function getAdminSystemEvents(params = {}) {
    const response = await api.get('system-events', { params });
    return response.data;
}

export async function getAdminSystemHealth(params = {}) {
    const response = await api.get('system-health', { params });
    return response.data;
}

export async function getAdminSettings() {
    const response = await api.get('settings');
    return response.data;
}

export async function updateAdminSettings(settings) {
    const response = await api.put('settings', settings);
    return response.data;
}

export async function getAdminCoupons(params = {}) {
    const response = await api.get('coupons', { params });
    return response.data;
}

export async function createAdminCoupon(couponData) {
    const response = await api.post('coupons', couponData);
    return response.data;
}

export async function getAdminCouponDetails(couponId) {
    const response = await api.get(`coupons/${couponId}`);
    return response.data;
}

export async function updateAdminCoupon(couponId, updates) {
    const response = await api.put(`coupons/${couponId}`, updates);
    return response.data;
}

export async function toggleAdminCouponStatus(couponId, isActive) {
    const response = await api.patch(`coupons/${couponId}/status`, { isActive });
    return response.data;
}

export async function getAdminUserSessions(userId, params = {}) {
    const response = await api.get(`users/${userId}/sessions`, { params });
    return response.data;
}

export async function revokeAdminSession(sessionId, reason = 'Revoked by administrator') {
    const response = await api.post(`sessions/${sessionId}/revoke`, { reason });
    return response.data;
}

export async function revokeAllAdminUserSessions(userId, reason = 'All sessions revoked by administrator') {
    const response = await api.post(`users/${userId}/sessions/revoke-all`, { reason });
    return response.data;
}

export async function rollbackAdminVersion() {
    const response = await api.post('settings/version/rollback');
    return response.data;
}

// B2B Partner & Organization Management
export async function getAdminOrganizations(params = {}) {
    const response = await api.get('organizations', { params });
    return response.data;
}

export async function getAdminOrganizationDetails(orgId) {
    const response = await api.get(`organizations/${orgId}`);
    return response.data;
}

export async function createAdminOrganization(orgData) {
    const response = await api.post('organizations', orgData);
    return response.data;
}

export async function updateAdminOrganization(orgId, updates) {
    const response = await api.put(`organizations/${orgId}`, updates);
    return response.data;
}

export async function setAdminOrganizationStatus(orgId, status, reason = '') {
    const response = await api.patch(`organizations/${orgId}/status`, { status, reason });
    return response.data;
}

export async function assignAdminOrgAdmin(orgId, userId) {
    const response = await api.post(`organizations/${orgId}/admins`, { userId });
    return response.data;
}

export async function removeAdminOrgAdmin(orgId, userId) {
    const response = await api.delete(`organizations/${orgId}/admins/${userId}`);
    return response.data;
}

export async function getAdminOrganizationStats(orgId) {
    const response = await api.get(`organizations/${orgId}/stats`);
    return response.data;
}

export async function getAdminOrganizationMembers(orgId, params = {}) {
    const response = await api.get(`organizations/${orgId}/members`, { params });
    return response.data;
}

export async function addAdminOrgMember(orgId, userId) {
    const response = await api.post(`organizations/${orgId}/members`, { userId });
    return response.data;
}

export async function removeAdminOrgMember(orgId, userId) {
    const response = await api.delete(`organizations/${orgId}/members/${userId}`);
    return response.data;
}

// ── Content Moderation System Endpoints ─────────────────────────────────────

export async function getAdminModerationQueue(params = {}) {
    const response = await api.get('moderation', { params });
    return response.data;
}

export async function getAdminModerationStats() {
    const response = await api.get('moderation/stats');
    return response.data;
}

export async function getAdminModerationDetails(id) {
    const response = await api.get(`moderation/${id}`);
    return response.data;
}

export async function applyAdminModerationDecision(id, payload) {
    const response = await api.post(`moderation/${id}/decision`, payload);
    return response.data;
}

export async function reviewAdminModerationAppeal(id, payload) {
    const response = await api.post(`moderation/${id}/appeal-review`, payload);
    return response.data;
}

export async function submitUserModerationAppeal(id, payload) {
    // Note: user appeal is on /api/moderation/:id/appeal
    const response = await api.post(`../moderation/${id}/appeal`, payload);
    return response.data;
}

// ── Dashboard-01 Analytics Endpoints ────────────────────────────────────────

export async function getAnalyticsOverview(params = {}) {
    const response = await api.get('analytics/overview', { params });
    return response.data;
}

export async function getAnalyticsTraffic(params = {}) {
    const response = await api.get('analytics/traffic', { params });
    return response.data;
}

export async function getAnalyticsRegistrations(params = {}) {
    const response = await api.get('analytics/registrations', { params });
    return response.data;
}

export async function getAnalyticsRevenue(params = {}) {
    const response = await api.get('analytics/revenue', { params });
    return response.data;
}

export async function getAnalyticsPlans() {
    const response = await api.get('analytics/plans');
    return response.data;
}

export async function getAnalyticsFeatureUsage(params = {}) {
    const response = await api.get('analytics/feature-usage', { params });
    return response.data;
}

export async function getAnalyticsHeatmap(params = {}) {
    const response = await api.get('analytics/activity-heatmap', { params });
    return response.data;
}

export async function getAnalyticsRecentUsers(params = {}) {
    const response = await api.get('analytics/recent-users', { params });
    return response.data;
}


