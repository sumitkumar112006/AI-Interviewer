import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getPublicAppConfig } from '../services/config.api';
import { CLIENT_APP_VERSION, isMandatoryUpdateRequired, isOptionalUpdateAvailable } from '../../../config/version.config';
import { MandatoryUpdateScreen } from '../components/MandatoryUpdateScreen';
import { OptionalUpdateBanner } from '../components/OptionalUpdateBanner';
import { MaintenanceScreen } from '../components/MaintenanceScreen';

const AppConfigContext = createContext(null);

export const AppConfigProvider = ({ children }) => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [forceUpdateOverride, setForceUpdateOverride] = useState(null);
    const [maintenanceOverride, setMaintenanceOverride] = useState(null);

    // Synchronize client version header across all standard axios calls
    useEffect(() => {
        axios.defaults.headers.common['X-App-Version'] = CLIENT_APP_VERSION;

        // Global Axios interceptor for 426 Upgrade Required and 503 Maintenance
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error?.response?.status === 426) {
                    const data = error.response.data || {};
                    setForceUpdateOverride({
                        minimumSupportedVersion: data.minimumSupportedVersion,
                        latestRecommendedVersion: data.latestRecommendedVersion,
                        updateUrl: data.updateUrl,
                        updateAnnouncement: data.updateAnnouncement
                    });
                } else if (error?.response?.status === 503 && error?.response?.data?.maintenanceMode) {
                    setMaintenanceOverride({
                        enabled: true,
                        message: error.response.data.message || ''
                    });
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    const fetchConfig = useCallback(async () => {
        try {
            const data = await getPublicAppConfig();
            if (data?.success) {
                setConfig(data);
                // If maintenance is turned off on server, clear override
                if (!data.maintenanceMode?.enabled) {
                    setMaintenanceOverride(null);
                }
                // If mandatory update condition is resolved, clear override
                if (!data.versionControl?.mandatoryUpdate) {
                    setForceUpdateOverride(null);
                }
            }
        } catch (err) {
            console.warn('[APP_CONFIG] Error refreshing config:', err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();

        // Check again when user returns to window tab
        const handleFocus = () => {
            fetchConfig();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [fetchConfig]);

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAdminRoute = currentPath.startsWith('/admin-portal-dashboard-root') || currentPath.startsWith('/admin-login-secret');

    // Determine states
    const activeMaintenance = maintenanceOverride?.enabled || (config?.maintenanceMode?.enabled && !isAdminRoute);
    const maintenanceMessage = maintenanceOverride?.message || config?.maintenanceMode?.message || '';

    const effectiveVc = forceUpdateOverride || config?.versionControl || {
        currentVersion: '1.0.0',
        minimumSupportedVersion: '1.0.0',
        latestRecommendedVersion: '1.0.0',
        mandatoryUpdate: false
    };

    const isMandatory = forceUpdateOverride || isMandatoryUpdateRequired(
        CLIENT_APP_VERSION,
        effectiveVc.minimumSupportedVersion,
        effectiveVc.mandatoryUpdate
    );

    const isOptional = !isMandatory && isOptionalUpdateAvailable(
        CLIENT_APP_VERSION,
        effectiveVc.latestRecommendedVersion
    );

    return (
        <AppConfigContext.Provider value={{
            config,
            loading,
            clientVersion: CLIENT_APP_VERSION,
            refreshConfig: fetchConfig,
            isMaintenance: Boolean(activeMaintenance),
            isMandatoryUpdate: Boolean(isMandatory),
            isOptionalUpdate: Boolean(isOptional)
        }}>
            {/* 1. Maintenance Screen takes absolute priority if engaged (except on admin routes) */}
            {activeMaintenance && !isAdminRoute ? (
                <MaintenanceScreen message={maintenanceMessage} onRefresh={fetchConfig} />
            ) : isMandatory ? (
                /* 2. Mandatory Update blocks user until client is updated */
                <MandatoryUpdateScreen updateConfig={effectiveVc} onRefresh={fetchConfig} />
            ) : (
                /* 3. Normal App with optional non-blocking update notification if available */
                <>
                    {isOptional && <OptionalUpdateBanner updateConfig={effectiveVc} />}
                    {children}
                </>
            )}
        </AppConfigContext.Provider>
    );
};

export const useAppConfig = () => {
    const context = useContext(AppConfigContext);
    if (!context) {
        throw new Error('useAppConfig must be used within an AppConfigProvider');
    }
    return context;
};

