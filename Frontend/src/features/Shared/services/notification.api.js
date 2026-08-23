import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://resume-generator-production-2eae.up.railway.app";
const api = axios.create({
    baseURL: `${API_BASE_URL.replace(/\/$/, "")}/api/notifications/`,
    withCredentials: true
});

export async function getNotifications() {
    const response = await api.get('');
    return response.data;
}

export async function markNotificationAsRead(id) {
    const response = await api.patch(`${id}/read`);
    return response.data;
}

export async function markAllNotificationsAsRead() {
    const response = await api.patch('read-all');
    return response.data;
}

export async function deleteNotification(id) {
    const response = await api.delete(`${id}`);
    return response.data;
}
