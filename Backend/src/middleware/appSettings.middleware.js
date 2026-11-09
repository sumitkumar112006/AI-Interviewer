/**
 * appSettings.middleware.js — Global App Configuration & Precedence Enforcement Middleware
 *
 * Implements:
 * 1. Global Maintenance Mode check with admin & IP whitelist bypass.
 * 2. Hierarchical feature enforcement:
 *    Global Feature Kill-Switch >> Individual User Blocked Features >> Quota/Tier Entitlements.
 * 3. Graceful 503 Service Unavailable & 403 Forbidden responses.
 */

'use strict';

const appSettingsService = require('../services/appSettings.service');

const FEATURE_LABELS = Object.freeze({
    resumeGeneration: 'Resume Generation & PDF Export',
    interviewReports: 'Mock Interview & Report Generation',
    aiAssistant: 'AI Assistant Copilot',
    coverLetterGeneration: 'Cover Letter & CV Generation'
});

/**
 * Middleware: Global Platform Maintenance Gate
 * Restricts all non-whitelisted public traffic when maintenance mode is engaged.
 */
async function checkMaintenanceMode(req, res, next) {
    try {
        const settings = await appSettingsService.getAppSettings();

        // If maintenance mode is disabled, proceed unconditionally
        if (!settings?.maintenanceMode?.enabled) {
            return next();
        }

        const path = req.path || req.originalUrl || '';

        // 1. Unconditionally exempt health checks, payment webhooks, and public app config
        if (
            path === '/' ||
            path === '/health' ||
            path.startsWith('/api/webhooks') ||
            path.startsWith('/api/config')
        ) {
            return next();
        }

        // 2. Allow administrative routes and admin authentication
        if (
            path.startsWith('/api/admin') ||
            path === '/api/auth/login' ||
            path === '/api/auth/admin-login' ||
            path === '/api/auth/logout' ||
            path === '/api/auth/me'
        ) {
            return next();
        }

        // 3. Check client IP against allowed IPs whitelist
        const clientIp = (
            req.headers['x-forwarded-for']?.split(',')[0] ||
            req.socket?.remoteAddress ||
            req.ip ||
            ''
        ).trim();

        if (clientIp && Array.isArray(settings.maintenanceMode.allowedIps) && settings.maintenanceMode.allowedIps.includes(clientIp)) {
            return next();
        }

        // 4. Check if authenticated user is an administrator
        const adminRoles = ['super_admin', 'admin', 'ops_admin'];
        if (req.user && adminRoles.includes(req.user.role)) {
            return next();
        }

        // Platform is in maintenance mode: return 503 Service Unavailable
        return res.status(503).json({
            success: false,
            maintenance: true,
            message: settings.maintenanceMode.message || 'KIVI AI is currently undergoing scheduled platform maintenance. Please check back shortly.',
            estimatedDuration: 'Check back soon'
        });
    } catch (err) {
        // Fail open: never break traffic if settings check itself errors
        console.error('[MAINTENANCE_GATE] Error inspecting maintenance mode:', err.message);
        return next();
    }
}

/**
 * Middleware factory: Enforces Precedence Hierarchy for a specific feature:
 * Precedence 1: Global Platform Kill-Switch (System-wide AppSettings)
 * Precedence 2: Per-User Account Blocked Features (User Model)
 * Precedence 3: Plan Quota / Tier Rate Limiters (Downstream)
 *
 * @param {string} featureName - One of ['resumeGeneration', 'interviewReports', 'aiAssistant', 'coverLetterGeneration']
 */
function enforceFeatureAccess(featureName) {
    return async (req, res, next) => {
        try {
            const label = FEATURE_LABELS[featureName] || featureName;

            // 1. Global Platform Kill-Switch
            const settings = await appSettingsService.getAppSettings();
            if (settings?.features && settings.features[featureName] === false) {
                return res.status(403).json({
                    success: false,
                    globalDisabled: true,
                    feature: featureName,
                    message: `${label} is temporarily disabled platform-wide by system administrators for scheduled maintenance.`
                });
            }

            // 2. Individual User Account Block
            if (req.user?.blockedFeatures?.[featureName]) {
                return res.status(403).json({
                    success: false,
                    userBlocked: true,
                    feature: featureName,
                    message: `${label} has been disabled for your account by an administrator. ❌`
                });
            }

            // 3. User & Feature Allowed -> Proceed to downstream quotas and handlers
            return next();
        } catch (err) {
            console.error(`[FEATURE_GATE] Error evaluating access for ${featureName}:`, err.message);
            // On unexpected error, fall back to checking user-level block directly
            if (req.user?.blockedFeatures?.[featureName]) {
                return res.status(403).json({
                    success: false,
                    userBlocked: true,
                    feature: featureName,
                    message: `Feature access has been disabled for your account by an administrator. ❌`
                });
            }
            return next();
        }
    };
}

/**
 * Middleware: Minimum Application Version Enforcement
 * Checks incoming client version header (x-app-version or x-client-version).
 * If mandatoryUpdate is engaged and client version is below minimum supported version,
 * returns HTTP 426 (Upgrade Required).
 */
async function enforceMinimumAppVersion(req, res, next) {
    try {
        const path = req.path || req.originalUrl || '';

        // Exempt health checks, webhooks, public config, admin routes, and preflights
        if (
            path === '/' ||
            path === '/health' ||
            path.startsWith('/api/webhooks') ||
            path.startsWith('/api/config') ||
            path.startsWith('/api/admin') ||
            req.method === 'OPTIONS'
        ) {
            return next();
        }

        const settings = await appSettingsService.getAppSettings();
        const vc = settings?.versionControl;

        // If mandatory update is not active, allow traffic
        if (!vc || !vc.mandatoryUpdate || !vc.minimumSupportedVersion) {
            return next();
        }

        const clientVersionHeader = (
            req.headers['x-app-version'] ||
            req.headers['x-client-version'] ||
            ''
        ).trim();

        // If no version header is provided (browser navigations or legacy clients),
        // do not lock out
        if (!clientVersionHeader) {
            return next();
        }

        const { isValidSemVer, compareSemVer } = require('../utils/semver');

        // Requirement: "Do not lock users out because of a malformed version value."
        if (!isValidSemVer(clientVersionHeader)) {
            console.warn(`[VERSION_CONTROL] Client supplied malformed version "${clientVersionHeader}". Bypassing block.`);
            return next();
        }

        // Compare against minimum supported version
        if (compareSemVer(clientVersionHeader, vc.minimumSupportedVersion) < 0) {
            return res.status(426).json({
                success: false,
                error: 'UPGRADE_REQUIRED',
                message: `Application version v${clientVersionHeader} is deprecated and no longer supported. Please update to v${vc.minimumSupportedVersion} or higher to continue using KIVI AI.`,
                clientVersion: clientVersionHeader,
                minimumSupportedVersion: vc.minimumSupportedVersion,
                latestRecommendedVersion: vc.latestRecommendedVersion || vc.minimumSupportedVersion,
                updateUrl: vc.updateUrl || '',
                updateAnnouncement: vc.updateAnnouncement || { title: '', message: '' }
            });
        }

        next();
    } catch (err) {
        console.error('[VERSION_CONTROL] Error evaluating app version:', err.message);
        next();
    }
}

module.exports = {
    checkMaintenanceMode,
    enforceMinimumAppVersion,
    enforceFeatureAccess,
    FEATURE_LABELS
};

