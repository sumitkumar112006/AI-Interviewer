/**
 * appSettings.service.js — Platform Configuration Management Service
 *
 * Implements:
 * 1. Persistent retrieval and caching (2-tier: local in-memory + Redis fallback).
 * 2. Whitelist-enforced validation for setting mutations (no arbitrary input, no code execution).
 * 3. Cache invalidation on mutation across Redis and local memory.
 * 4. Audit logging & system operational events for every configuration change.
 * 5. Safe, resilient fallbacks if Redis or MongoDB is unreachable.
 */

'use strict';

const mongoose = require('mongoose');
const AppSettings = require('../models/appSettings.model');
const { getRedisClient } = require('../config/redis');
const auditLogService = require('./auditLog.service');
const systemEventModel = require('../models/systemEvent.model');

const SETTINGS_CACHE_KEY = 'config:app_settings';
const MEMORY_CACHE_TTL_MS = 60 * 1000; // 60 seconds local memory cache
const REDIS_CACHE_TTL_SEC = 300;       // 5 minutes in Redis

// Safe baseline defaults in case DB and Redis are both unreachable
const DEFAULT_APP_SETTINGS = Object.freeze({
    key: 'global_settings',
    maintenanceMode: Object.freeze({
        enabled: false,
        message: 'KIVI AI is currently undergoing scheduled platform maintenance. Please check back shortly.',
        allowedIps: Object.freeze([])
    }),
    newRegistrationEnabled: true,
    versionControl: Object.freeze({
        currentVersion: '1.0.0',
        minimumSupportedVersion: '1.0.0',
        latestRecommendedVersion: '1.0.0',
        mandatoryUpdate: false,
        updateAnnouncement: Object.freeze({
            title: '',
            message: ''
        }),
        updateUrl: ''
    }),
    previousVersionControl: null,
    features: Object.freeze({
        resumeGeneration: true,
        interviewReports: true,
        aiAssistant: true,
        coverLetterGeneration: true
    }),
    ai: Object.freeze({
        defaultProvider: 'auto',
        allowedProviders: Object.freeze(['auto', 'groq', 'gemini', 'openrouter'])
    }),
    generationLimits: Object.freeze({
        freeTierMonthlyQuota: 2,
        freeTierDailyAssistantLimit: 50
    })
});

// Tier 1: Local In-Memory Cache for ultra-fast (sub-millisecond) retrieval
let localCache = null;
let localCacheExpiry = 0;

/**
 * Safely get Redis client instance
 */
function getRedisSafely() {
    try {
        const client = getRedisClient ? getRedisClient() : null;
        if (client && (client.status === 'ready' || client.status === 'connect')) {
            return client;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Invalidate both local memory and Redis cache
 */
async function invalidateSettingsCache() {
    localCache = null;
    localCacheExpiry = 0;

    const redis = getRedisSafely();
    if (redis) {
        try {
            await redis.del(SETTINGS_CACHE_KEY);
        } catch (err) {
            console.warn('[APP_SETTINGS] Redis cache invalidation warning:', err.message);
        }
    }
}

/**
 * Retrieve global platform settings with 2-tier caching:
 * Local memory -> Redis -> MongoDB -> Safe Defaults
 */
async function getAppSettings() {
    const now = Date.now();

    // 1. Check local memory cache
    if (localCache && now < localCacheExpiry) {
        return localCache;
    }

    // 2. Check Redis cache
    const redis = getRedisSafely();
    if (redis) {
        try {
            const cachedJson = await redis.get(SETTINGS_CACHE_KEY);
            if (cachedJson) {
                const parsed = JSON.parse(cachedJson);
                localCache = parsed;
                localCacheExpiry = now + MEMORY_CACHE_TTL_MS;
                return parsed;
            }
        } catch (err) {
            console.warn('[APP_SETTINGS] Redis get cache warning:', err.message);
        }
    }

    // 3. Query MongoDB
    try {
        let doc = await AppSettings.findOne({ key: 'global_settings' }).lean();

        if (!doc) {
            // First run: seed default settings in MongoDB
            doc = await AppSettings.findOneAndUpdate(
                { key: 'global_settings' },
                { $setOnInsert: DEFAULT_APP_SETTINGS },
                { upsert: true, returnDocument: 'after', lean: true }
            );
        }

        const settingsData = {
            key: doc?.key || 'global_settings',
            maintenanceMode: {
                enabled: Boolean(doc.maintenanceMode?.enabled),
                message: doc.maintenanceMode?.message || DEFAULT_APP_SETTINGS.maintenanceMode.message,
                allowedIps: Array.isArray(doc.maintenanceMode?.allowedIps) ? doc.maintenanceMode.allowedIps : []
            },
            newRegistrationEnabled: doc.newRegistrationEnabled !== false,
            features: {
                resumeGeneration: doc.features?.resumeGeneration !== false,
                interviewReports: doc.features?.interviewReports !== false,
                aiAssistant: doc.features?.aiAssistant !== false,
                coverLetterGeneration: doc.features?.coverLetterGeneration !== false
            },
            ai: {
                defaultProvider: doc.ai?.defaultProvider || 'auto',
                allowedProviders: ['auto', 'groq', 'gemini', 'openrouter']
            },
            generationLimits: {
                freeTierMonthlyQuota: Number.isInteger(doc.generationLimits?.freeTierMonthlyQuota)
                    ? doc.generationLimits.freeTierMonthlyQuota
                    : DEFAULT_APP_SETTINGS.generationLimits.freeTierMonthlyQuota,
                freeTierDailyAssistantLimit: Number.isInteger(doc.generationLimits?.freeTierDailyAssistantLimit)
                    ? doc.generationLimits.freeTierDailyAssistantLimit
                    : DEFAULT_APP_SETTINGS.generationLimits.freeTierDailyAssistantLimit
            },
            lastUpdatedBy: doc.lastUpdatedBy,
            lastUpdatedByUsername: doc.lastUpdatedByUsername || 'system',
            updatedAt: doc.updatedAt || new Date()
        };

        // Populate local cache
        localCache = settingsData;
        localCacheExpiry = now + MEMORY_CACHE_TTL_MS;

        // Populate Redis cache asynchronously
        if (redis) {
            redis.set(SETTINGS_CACHE_KEY, JSON.stringify(settingsData), 'EX', REDIS_CACHE_TTL_SEC).catch((err) => {
                console.warn('[APP_SETTINGS] Redis set cache warning:', err.message);
            });
        }

        return settingsData;
    } catch (err) {
        console.error('[APP_SETTINGS] Failed to load settings from DB:', err.message);
        // Resilient fallback: return localCache if existed, or defaults
        return localCache || DEFAULT_APP_SETTINGS;
    }
}

/**
 * Whitelist validation helper for updating settings
 * Prevents arbitrary field injection, code execution, or illegal provider names.
 */
function validateSettingsPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid settings payload: must be a JSON object.');
    }

    const allowedKeys = new Set([
        'maintenanceMode',
        'newRegistrationEnabled',
        'versionControl',
        'features',
        'ai',
        'generationLimits'
    ]);

    for (const key of Object.keys(payload)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`Unrecognized configuration field "${key}". Updates to arbitrary fields are rejected.`);
        }
    }

    const sanitized = {};

    // Validate maintenanceMode
    if (payload.maintenanceMode !== undefined) {
        if (typeof payload.maintenanceMode !== 'object' || payload.maintenanceMode === null) {
            throw new Error('maintenanceMode must be an object.');
        }
        sanitized.maintenanceMode = {};

        if (payload.maintenanceMode.enabled !== undefined) {
            if (typeof payload.maintenanceMode.enabled !== 'boolean') {
                throw new Error('maintenanceMode.enabled must be a boolean.');
            }
            sanitized.maintenanceMode.enabled = payload.maintenanceMode.enabled;
        }

        if (payload.maintenanceMode.message !== undefined) {
            if (typeof payload.maintenanceMode.message !== 'string') {
                throw new Error('maintenanceMode.message must be a string.');
            }
            if (payload.maintenanceMode.message.length > 500) {
                throw new Error('maintenanceMode.message cannot exceed 500 characters.');
            }
            sanitized.maintenanceMode.message = payload.maintenanceMode.message.trim();
        }

        if (payload.maintenanceMode.allowedIps !== undefined) {
            if (!Array.isArray(payload.maintenanceMode.allowedIps)) {
                throw new Error('maintenanceMode.allowedIps must be an array of IP strings.');
            }
            sanitized.maintenanceMode.allowedIps = payload.maintenanceMode.allowedIps
                .map(ip => String(ip).trim())
                .filter(Boolean);
        }
    }

    // Validate newRegistrationEnabled
    if (payload.newRegistrationEnabled !== undefined) {
        if (typeof payload.newRegistrationEnabled !== 'boolean') {
            throw new Error('newRegistrationEnabled must be a boolean.');
        }
        sanitized.newRegistrationEnabled = payload.newRegistrationEnabled;
    }

    // Validate versionControl
    if (payload.versionControl !== undefined) {
        if (typeof payload.versionControl !== 'object' || payload.versionControl === null) {
            throw new Error('versionControl must be an object.');
        }
        sanitized.versionControl = {};

        const { isValidSemVer, compareSemVer } = require('../utils/semver');

        if (payload.versionControl.currentVersion !== undefined) {
            if (typeof payload.versionControl.currentVersion !== 'string' || !isValidSemVer(payload.versionControl.currentVersion)) {
                throw new Error('versionControl.currentVersion must be a valid semantic version (e.g., 1.0.0).');
            }
            sanitized.versionControl.currentVersion = payload.versionControl.currentVersion.trim();
        }

        if (payload.versionControl.minimumSupportedVersion !== undefined) {
            if (typeof payload.versionControl.minimumSupportedVersion !== 'string' || !isValidSemVer(payload.versionControl.minimumSupportedVersion)) {
                throw new Error('versionControl.minimumSupportedVersion must be a valid semantic version (e.g., 1.0.0).');
            }
            sanitized.versionControl.minimumSupportedVersion = payload.versionControl.minimumSupportedVersion.trim();
        }

        if (payload.versionControl.latestRecommendedVersion !== undefined) {
            if (typeof payload.versionControl.latestRecommendedVersion !== 'string' || !isValidSemVer(payload.versionControl.latestRecommendedVersion)) {
                throw new Error('versionControl.latestRecommendedVersion must be a valid semantic version (e.g., 1.0.0).');
            }
            sanitized.versionControl.latestRecommendedVersion = payload.versionControl.latestRecommendedVersion.trim();
        }

        // Logical validation: minimumSupportedVersion cannot be higher than latestRecommendedVersion
        const minVer = sanitized.versionControl.minimumSupportedVersion || payload.versionControl.minimumSupportedVersion;
        const recVer = sanitized.versionControl.latestRecommendedVersion || payload.versionControl.latestRecommendedVersion;
        if (minVer && recVer && compareSemVer(minVer, recVer) > 0) {
            throw new Error(`Minimum supported version (${minVer}) cannot be higher than latest recommended version (${recVer}).`);
        }

        if (payload.versionControl.mandatoryUpdate !== undefined) {
            if (typeof payload.versionControl.mandatoryUpdate !== 'boolean') {
                throw new Error('versionControl.mandatoryUpdate must be a boolean.');
            }
            sanitized.versionControl.mandatoryUpdate = payload.versionControl.mandatoryUpdate;
        }

        if (payload.versionControl.updateAnnouncement !== undefined) {
            if (typeof payload.versionControl.updateAnnouncement !== 'object' || payload.versionControl.updateAnnouncement === null) {
                throw new Error('versionControl.updateAnnouncement must be an object.');
            }
            sanitized.versionControl.updateAnnouncement = {};

            if (payload.versionControl.updateAnnouncement.title !== undefined) {
                if (typeof payload.versionControl.updateAnnouncement.title !== 'string') {
                    throw new Error('versionControl.updateAnnouncement.title must be a string.');
                }
                sanitized.versionControl.updateAnnouncement.title = payload.versionControl.updateAnnouncement.title.trim().slice(0, 150);
            }

            if (payload.versionControl.updateAnnouncement.message !== undefined) {
                if (typeof payload.versionControl.updateAnnouncement.message !== 'string') {
                    throw new Error('versionControl.updateAnnouncement.message must be a string.');
                }
                sanitized.versionControl.updateAnnouncement.message = payload.versionControl.updateAnnouncement.message.trim().slice(0, 500);
            }
        }

        if (payload.versionControl.updateUrl !== undefined) {
            if (typeof payload.versionControl.updateUrl !== 'string') {
                throw new Error('versionControl.updateUrl must be a string.');
            }
            const cleanUrl = payload.versionControl.updateUrl.trim();
            if (cleanUrl && !/^https?:\/\//i.test(cleanUrl) && !cleanUrl.startsWith('/')) {
                throw new Error('versionControl.updateUrl must be a valid HTTP/HTTPS URL or relative path.');
            }
            sanitized.versionControl.updateUrl = cleanUrl;
        }
    }

    // Validate features
    if (payload.features !== undefined) {
        if (typeof payload.features !== 'object' || payload.features === null) {
            throw new Error('features must be an object.');
        }
        const allowedFeatures = ['resumeGeneration', 'interviewReports', 'aiAssistant', 'coverLetterGeneration'];
        sanitized.features = {};

        for (const feat of Object.keys(payload.features)) {
            if (!allowedFeatures.includes(feat)) {
                throw new Error(`Unrecognized feature key "${feat}".`);
            }
            if (typeof payload.features[feat] !== 'boolean') {
                throw new Error(`features.${feat} must be a boolean.`);
            }
            sanitized.features[feat] = payload.features[feat];
        }
    }

    // Validate AI provider settings
    if (payload.ai !== undefined) {
        if (typeof payload.ai !== 'object' || payload.ai === null) {
            throw new Error('ai must be an object.');
        }
        sanitized.ai = {};

        if (payload.ai.defaultProvider !== undefined) {
            const validProviders = ['auto', 'groq', 'gemini', 'openrouter'];
            if (!validProviders.includes(payload.ai.defaultProvider)) {
                throw new Error(`Invalid AI provider "${payload.ai.defaultProvider}". Allowed: ${validProviders.join(', ')}.`);
            }
            sanitized.ai.defaultProvider = payload.ai.defaultProvider;
        }
    }

    // Validate generation limits
    if (payload.generationLimits !== undefined) {
        if (typeof payload.generationLimits !== 'object' || payload.generationLimits === null) {
            throw new Error('generationLimits must be an object.');
        }
        sanitized.generationLimits = {};

        if (payload.generationLimits.freeTierMonthlyQuota !== undefined) {
            const val = Number(payload.generationLimits.freeTierMonthlyQuota);
            if (!Number.isInteger(val) || val < 0 || val > 100) {
                throw new Error('freeTierMonthlyQuota must be an integer between 0 and 100.');
            }
            sanitized.generationLimits.freeTierMonthlyQuota = val;
        }

        if (payload.generationLimits.freeTierDailyAssistantLimit !== undefined) {
            const val = Number(payload.generationLimits.freeTierDailyAssistantLimit);
            if (!Number.isInteger(val) || val < 0 || val > 1000) {
                throw new Error('freeTierDailyAssistantLimit must be an integer between 0 and 1000.');
            }
            sanitized.generationLimits.freeTierDailyAssistantLimit = val;
        }
    }

    return sanitized;
}

/**
 * Update global platform settings with audit recording, cache invalidation, and system event logging.
 */
async function updateAppSettings(payload, context = {}) {
    const { actorId, actorUsername = 'system', actorRole = 'admin', req } = context;

    // Validate against strict whitelist
    const sanitized = validateSettingsPayload(payload);

    // Fetch existing settings before update for audit diff
    const currentSettings = await getAppSettings();

    // Prepare update operations
    const updateOps = {
        $set: {
            lastUpdatedBy: (actorId && mongoose.isValidObjectId(actorId)) ? actorId : null,
            lastUpdatedByUsername: actorUsername
        }
    };

    if (sanitized.maintenanceMode) {
        for (const [subKey, val] of Object.entries(sanitized.maintenanceMode)) {
            updateOps.$set[`maintenanceMode.${subKey}`] = val;
        }
    }

    if (sanitized.newRegistrationEnabled !== undefined) {
        updateOps.$set.newRegistrationEnabled = sanitized.newRegistrationEnabled;
    }

    if (sanitized.features) {
        for (const [feat, val] of Object.entries(sanitized.features)) {
            updateOps.$set[`features.${feat}`] = val;
        }
    }

    if (sanitized.ai?.defaultProvider !== undefined) {
        updateOps.$set['ai.defaultProvider'] = sanitized.ai.defaultProvider;
    }

    if (sanitized.generationLimits) {
        for (const [lim, val] of Object.entries(sanitized.generationLimits)) {
            updateOps.$set[`generationLimits.${lim}`] = val;
        }
    }

    if (sanitized.versionControl) {
        // Preserve previous valid version configuration for instant rollback
        if (currentSettings.versionControl) {
            updateOps.$set.previousVersionControl = {
                currentVersion: currentSettings.versionControl.currentVersion || '1.0.0',
                minimumSupportedVersion: currentSettings.versionControl.minimumSupportedVersion || '1.0.0',
                latestRecommendedVersion: currentSettings.versionControl.latestRecommendedVersion || '1.0.0',
                mandatoryUpdate: Boolean(currentSettings.versionControl.mandatoryUpdate),
                updateAnnouncement: {
                    title: currentSettings.versionControl.updateAnnouncement?.title || '',
                    message: currentSettings.versionControl.updateAnnouncement?.message || ''
                },
                updateUrl: currentSettings.versionControl.updateUrl || '',
                archivedAt: new Date(),
                archivedBy: actorUsername
            };
        }

        for (const [vKey, val] of Object.entries(sanitized.versionControl)) {
            if (vKey === 'updateAnnouncement' && typeof val === 'object') {
                for (const [annKey, annVal] of Object.entries(val)) {
                    updateOps.$set[`versionControl.updateAnnouncement.${annKey}`] = annVal;
                }
            } else {
                updateOps.$set[`versionControl.${vKey}`] = val;
            }
        }
    }

    // Persist to MongoDB
    const updatedDoc = await AppSettings.findOneAndUpdate(
        { key: 'global_settings' },
        updateOps,
        { upsert: true, returnDocument: 'after', runValidators: true, lean: true }
    );

    // Invalidate caches immediately
    await invalidateSettingsCache();

    // Audit changes
    const changesSummary = Object.keys(sanitized).map(key => {
        return `${key}: ${JSON.stringify(sanitized[key])}`;
    }).join('; ');

    const isMaintenanceToggled = sanitized.maintenanceMode?.enabled !== undefined &&
        sanitized.maintenanceMode.enabled !== currentSettings.maintenanceMode.enabled;
    const isVersionUpdated = Boolean(sanitized.versionControl);

    // 1. Record Admin Audit Log
    try {
        await auditLogService.recordAdminAudit({
            req,
            action: isMaintenanceToggled 
                ? 'MAINTENANCE_MODE_TOGGLE' 
                : (isVersionUpdated ? 'APP_VERSION_UPDATED' : 'SETTINGS_UPDATE'),
            category: 'ADMIN',
            severity: isMaintenanceToggled ? 'WARN' : 'INFO',
            targetType: 'AppSettings',
            targetIdentifier: 'global_settings',
            before: currentSettings,
            after: sanitized,
            changeSummary: `Admin "${actorUsername}" (${actorRole}) updated global platform settings: [${changesSummary}]`
        });
    } catch (auditErr) {
        console.warn('[APP_SETTINGS] Failed to record audit log:', auditErr.message);
    }

    // 2. Record High-Priority System Event
    try {
        await systemEventModel.recordOperationalEvent({
            eventType: isMaintenanceToggled 
                ? 'MAINTENANCE_MODE_TOGGLED' 
                : (isVersionUpdated ? 'APP_VERSION_UPDATED' : 'GLOBAL_SETTINGS_UPDATED'),
            category: 'ADMIN',
            severity: isMaintenanceToggled ? 'WARN' : 'INFO',
            message: `Global platform settings updated by ${actorUsername}. Summary: ${changesSummary}`,
            metadata: {
                actorId,
                actorUsername,
                actorRole,
                changes: sanitized
            }
        });
    } catch (sysErr) {
        console.warn('[APP_SETTINGS] Failed to record system event:', sysErr.message);
    }

    return await getAppSettings();
}

/**
 * Roll back version control configuration to the previous valid state.
 */
async function rollbackVersionControl(context = {}) {
    const currentSettings = await module.exports.getAppSettings();
    const previous = currentSettings.previousVersionControl;

    if (!previous || typeof previous !== 'object') {
        throw new Error('No previous version configuration available to restore.');
    }

    const previousClean = {
        currentVersion: previous.currentVersion || '1.0.0',
        minimumSupportedVersion: previous.minimumSupportedVersion || '1.0.0',
        latestRecommendedVersion: previous.latestRecommendedVersion || '1.0.0',
        mandatoryUpdate: Boolean(previous.mandatoryUpdate),
        updateAnnouncement: {
            title: previous.updateAnnouncement?.title || '',
            message: previous.updateAnnouncement?.message || ''
        },
        updateUrl: previous.updateUrl || ''
    };

    return await module.exports.updateAppSettings({ versionControl: previousClean }, context);
}

/**
 * Safe, public configuration payload for client consumption.
 * Strictly filters out any admin-only settings (allowedIps, ai keys, internal limits, audit stamps).
 */
async function getPublicAppConfig() {
    const settings = await module.exports.getAppSettings();

    return {
        success: true,
        versionControl: {
            currentVersion: settings.versionControl?.currentVersion || '1.0.0',
            minimumSupportedVersion: settings.versionControl?.minimumSupportedVersion || '1.0.0',
            latestRecommendedVersion: settings.versionControl?.latestRecommendedVersion || '1.0.0',
            mandatoryUpdate: Boolean(settings.versionControl?.mandatoryUpdate),
            updateAnnouncement: {
                title: settings.versionControl?.updateAnnouncement?.title || '',
                message: settings.versionControl?.updateAnnouncement?.message || ''
            },
            updateUrl: settings.versionControl?.updateUrl || ''
        },
        maintenanceMode: {
            enabled: Boolean(settings.maintenanceMode?.enabled),
            message: settings.maintenanceMode?.message || 'KIVI AI is currently undergoing scheduled platform maintenance.'
        }
    };
}

module.exports = {
    DEFAULT_APP_SETTINGS,
    getAppSettings,
    updateAppSettings,
    invalidateSettingsCache,
    validateSettingsPayload,
    rollbackVersionControl,
    getPublicAppConfig
};
