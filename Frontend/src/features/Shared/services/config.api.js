/**
 * config.api.js — Public Client Configuration API Client
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://kivi-ai-production.up.railway.app";
const api = axios.create({
    baseURL: `${API_BASE_URL.replace(/\/$/, "")}/api/config/`,
    withCredentials: true
});

/**
 * Fetch public application configuration (version control & maintenance mode)
 */
export async function getPublicAppConfig() {
    try {
        const response = await api.get('version');
        return response.data;
    } catch (err) {
        console.warn('[CONFIG_API] Failed to fetch public app configuration:', err.message);
        // Resilient fallback defaults
        return {
            success: true,
            versionControl: {
                currentVersion: '1.0.0',
                minimumSupportedVersion: '1.0.0',
                latestRecommendedVersion: '1.0.0',
                mandatoryUpdate: false,
                updateAnnouncement: { title: '', message: '' },
                updateUrl: ''
            },
            maintenanceMode: {
                enabled: false,
                message: ''
            }
        };
    }
}

