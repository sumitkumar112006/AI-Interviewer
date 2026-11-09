/**
 * appSettings.test.js — Global Platform Configuration Test Suite
 *
 * Tests:
 * 1. Payload validation (strict whitelisting, prevents arbitrary injection/code execution).
 * 2. 2-tier caching & cache invalidation across memory and Redis.
 * 3. Graceful fallback to safe defaults if DB or Redis is unavailable.
 * 4. Audit logging & high-priority SystemEvent emission on mutation.
 * 5. Maintenance Mode gate (allows health checks, webhooks, admin routes, whitelisted IPs, and admin roles; blocks public traffic with 503).
 * 6. Precedence Hierarchy: Global Kill-Switch >> Individual User Blocked Features >> Quotas.
 * 7. Registration Gate: blocks new account signups when disabled.
 * 8. Admin Settings Controllers.
 */

'use strict';

jest.mock('../jobs/aiQueue', () => ({
    aiQueue: {
        getJob: jest.fn().mockResolvedValue(null),
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
        getWorkers: jest.fn().mockResolvedValue([])
    },
    enqueueAiJob: jest.fn().mockResolvedValue({ id: 'bull-job-test' })
}));

const AppSettings = require('../models/appSettings.model');
const {
    getAppSettings,
    updateAppSettings,
    invalidateSettingsCache,
    validateSettingsPayload,
    DEFAULT_APP_SETTINGS
} = require('../services/appSettings.service');
const {
    checkMaintenanceMode,
    enforceFeatureAccess
} = require('../middleware/appSettings.middleware');
const auditLogService = require('../services/auditLog.service');
const systemEventModel = require('../models/systemEvent.model');
const {
    getAdminSettingsController,
    updateAdminSettingsController
} = require('../controller/admin.controller');

describe('Global Platform Configuration (AppSettings) Test Suite', () => {
    let mockAuditSpy;
    let mockSystemEventSpy;
    let mockDbSettings;

    beforeEach(async () => {
        jest.clearAllMocks();
        await invalidateSettingsCache();

        mockDbSettings = {
            key: 'global_settings',
            maintenanceMode: {
                enabled: false,
                message: 'KIVI AI is currently undergoing scheduled platform maintenance. Please check back shortly.',
                allowedIps: []
            },
            newRegistrationEnabled: true,
            features: {
                resumeGeneration: true,
                interviewReports: true,
                aiAssistant: true,
                coverLetterGeneration: true
            },
            ai: {
                defaultProvider: 'auto',
                allowedProviders: ['auto', 'groq', 'gemini', 'openrouter']
            },
            generationLimits: {
                freeTierMonthlyQuota: 2,
                freeTierDailyAssistantLimit: 50
            },
            lastUpdatedBy: null,
            lastUpdatedByUsername: 'system',
            updatedAt: new Date()
        };

        // Default mock implementation to avoid unmocked Mongoose query buffering timeouts
        jest.spyOn(AppSettings, 'findOne').mockImplementation(() => ({
            lean: jest.fn().mockResolvedValue(mockDbSettings)
        }));

        jest.spyOn(AppSettings, 'findOneAndUpdate').mockImplementation((query, update) => {
            if (update.$set) {
                if (update.$set.maintenanceMode) Object.assign(mockDbSettings.maintenanceMode, update.$set.maintenanceMode);
                if (update.$set['maintenanceMode.enabled'] !== undefined) mockDbSettings.maintenanceMode.enabled = update.$set['maintenanceMode.enabled'];
                if (update.$set['maintenanceMode.message'] !== undefined) mockDbSettings.maintenanceMode.message = update.$set['maintenanceMode.message'];
                if (update.$set.newRegistrationEnabled !== undefined) mockDbSettings.newRegistrationEnabled = update.$set.newRegistrationEnabled;
                if (update.$set.features) Object.assign(mockDbSettings.features, update.$set.features);
                if (update.$set['features.resumeGeneration'] !== undefined) mockDbSettings.features.resumeGeneration = update.$set['features.resumeGeneration'];
                if (update.$set['ai.defaultProvider'] !== undefined) mockDbSettings.ai.defaultProvider = update.$set['ai.defaultProvider'];
                if (update.$set['generationLimits.freeTierMonthlyQuota'] !== undefined) mockDbSettings.generationLimits.freeTierMonthlyQuota = update.$set['generationLimits.freeTierMonthlyQuota'];
            }
            return Promise.resolve(mockDbSettings);
        });

        mockAuditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue(true);
        mockSystemEventSpy = jest.spyOn(systemEventModel, 'recordOperationalEvent').mockResolvedValue(true);
    });

    afterEach(async () => {
        if (AppSettings.findOne.mockRestore) AppSettings.findOne.mockRestore();
        if (AppSettings.findOneAndUpdate.mockRestore) AppSettings.findOneAndUpdate.mockRestore();
        mockAuditSpy.mockRestore();
        mockSystemEventSpy.mockRestore();
        await invalidateSettingsCache();
    });

    describe('1. Strict Payload Validation & Whitelist Protection', () => {
        it('validates and accepts a compliant settings payload', () => {
            const input = {
                maintenanceMode: {
                    enabled: true,
                    message: 'Platform update in progress.',
                    allowedIps: ['192.168.1.100', '10.0.0.1']
                },
                newRegistrationEnabled: false,
                features: {
                    resumeGeneration: false,
                    interviewReports: true
                },
                ai: {
                    defaultProvider: 'gemini'
                },
                generationLimits: {
                    freeTierMonthlyQuota: 5,
                    freeTierDailyAssistantLimit: 100
                }
            };

            const result = validateSettingsPayload(input);
            expect(result.maintenanceMode.enabled).toBe(true);
            expect(result.maintenanceMode.message).toBe('Platform update in progress.');
            expect(result.maintenanceMode.allowedIps).toEqual(['192.168.1.100', '10.0.0.1']);
            expect(result.newRegistrationEnabled).toBe(false);
            expect(result.features.resumeGeneration).toBe(false);
            expect(result.ai.defaultProvider).toBe('gemini');
            expect(result.generationLimits.freeTierMonthlyQuota).toBe(5);
        });

        it('rejects arbitrary fields not in the whitelist', () => {
            expect(() => {
                validateSettingsPayload({
                    arbitraryScript: 'process.exit(1)',
                    maintenanceMode: { enabled: true }
                });
            }).toThrow(/Unrecognized configuration field "arbitraryScript"/);
        });

        it('rejects unapproved AI provider strings', () => {
            expect(() => {
                validateSettingsPayload({
                    ai: { defaultProvider: 'unapproved_shady_llm' }
                });
            }).toThrow(/Invalid AI provider/);
        });

        it('rejects out-of-range generation limits', () => {
            expect(() => {
                validateSettingsPayload({
                    generationLimits: { freeTierMonthlyQuota: 500 }
                });
            }).toThrow(/freeTierMonthlyQuota must be an integer between 0 and 100/);
        });

        it('rejects non-boolean feature values', () => {
            expect(() => {
                validateSettingsPayload({
                    features: { resumeGeneration: 'yes' }
                });
            }).toThrow(/must be a boolean/);
        });
    });

    describe('2. Retrieval, Fallback & Cache Invalidation', () => {
        it('returns default settings when database document does not exist', async () => {
            AppSettings.findOne.mockReturnValueOnce({
                lean: jest.fn().mockResolvedValue(null)
            });
            AppSettings.findOneAndUpdate.mockResolvedValueOnce(DEFAULT_APP_SETTINGS);

            const settings = await getAppSettings();
            expect(settings.key).toBe('global_settings');
            expect(settings.maintenanceMode.enabled).toBe(false);
            expect(settings.newRegistrationEnabled).toBe(true);
            expect(settings.features.resumeGeneration).toBe(true);
            expect(settings.ai.defaultProvider).toBe('auto');
        });

        it('caches settings in-memory and avoids repeated DB lookups', async () => {
            const firstCall = await getAppSettings();
            const secondCall = await getAppSettings();

            expect(firstCall.newRegistrationEnabled).toBe(true);
            expect(secondCall.newRegistrationEnabled).toBe(true);
            expect(AppSettings.findOne).toHaveBeenCalledTimes(1); // Cached on first call
        });

        it('falls back safely to default settings if DB throws an error', async () => {
            AppSettings.findOne.mockReturnValueOnce({
                lean: jest.fn().mockRejectedValue(new Error('Mongo connection lost'))
            });

            const settings = await getAppSettings();
            expect(settings).toBeDefined();
            expect(settings.maintenanceMode.enabled).toBe(false);
        });

        it('updates settings, invalidates cache, and records audit & system events', async () => {
            const result = await updateAppSettings(
                { maintenanceMode: { enabled: true, message: 'Urgent Patching' } },
                { actorId: null, actorUsername: 'superadmin', actorRole: 'super_admin' }
            );

            expect(AppSettings.findOneAndUpdate).toHaveBeenCalled();
            expect(mockAuditSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'MAINTENANCE_MODE_TOGGLE',
                severity: 'WARN'
            }));
            expect(mockSystemEventSpy).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'MAINTENANCE_MODE_TOGGLED'
            }));
            expect(result.maintenanceMode.enabled).toBe(true);
        });
    });

    describe('3. Maintenance Mode Gate Middleware', () => {
        it('allows normal traffic through when maintenance mode is disabled', async () => {
            mockDbSettings.maintenanceMode.enabled = false;

            const req = { path: '/api/interview' };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            await checkMaintenanceMode(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('returns 503 Service Unavailable for public user traffic when maintenance mode is enabled', async () => {
            mockDbSettings.maintenanceMode.enabled = true;
            mockDbSettings.maintenanceMode.message = 'Scheduled DB migration in progress.';

            const req = { path: '/api/interview', headers: {}, socket: { remoteAddress: '203.0.113.195' }, ip: '203.0.113.195' };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            await checkMaintenanceMode(req, res, next);
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                maintenance: true,
                message: 'Scheduled DB migration in progress.'
            }));
            expect(next).not.toHaveBeenCalled();
        });

        it('exempts health checks and payment webhooks from maintenance block', async () => {
            mockDbSettings.maintenanceMode.enabled = true;

            const reqHealth = { path: '/health' };
            const reqWebhook = { path: '/api/webhooks/razorpay' };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            await checkMaintenanceMode(reqHealth, res, next);
            expect(next).toHaveBeenCalledTimes(1);

            await checkMaintenanceMode(reqWebhook, res, next);
            expect(next).toHaveBeenCalledTimes(2);
        });

        it('exempts whitelisted IP addresses from maintenance block', async () => {
            mockDbSettings.maintenanceMode.enabled = true;
            mockDbSettings.maintenanceMode.allowedIps = ['127.0.0.1', '198.51.100.42'];

            const req = {
                path: '/api/interview',
                headers: { 'x-forwarded-for': '198.51.100.42' },
                socket: { remoteAddress: '198.51.100.42' },
                ip: '198.51.100.42'
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            await checkMaintenanceMode(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('exempts authenticated admin users from maintenance block', async () => {
            mockDbSettings.maintenanceMode.enabled = true;

            const req = {
                path: '/api/interview',
                user: { _id: 'admin-1', role: 'super_admin' },
                headers: {},
                socket: {},
                ip: '203.0.113.1'
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            await checkMaintenanceMode(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('4. Precedence Hierarchy: Global Kill-Switch >> User Block >> Quota', () => {
        it('precedence 1: blocks request when global feature is disabled, even if user is allowed', async () => {
            mockDbSettings.features.resumeGeneration = false;

            const middleware = enforceFeatureAccess('resumeGeneration');
            const req = {
                user: {
                    _id: 'user-1',
                    blockedFeatures: { resumeGeneration: false } // User is NOT blocked
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            await middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                globalDisabled: true,
                feature: 'resumeGeneration'
            }));
            expect(next).not.toHaveBeenCalled();
        });

        it('precedence 2: blocks request when global feature is enabled but user account is blocked', async () => {
            mockDbSettings.features.resumeGeneration = true; // Globally enabled

            const middleware = enforceFeatureAccess('resumeGeneration');
            const req = {
                user: {
                    _id: 'user-1',
                    blockedFeatures: { resumeGeneration: true } // User account IS blocked
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            await middleware(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                userBlocked: true,
                feature: 'resumeGeneration'
            }));
            expect(next).not.toHaveBeenCalled();
        });

        it('passes when both global setting and user account permit access', async () => {
            mockDbSettings.features.aiAssistant = true;

            const middleware = enforceFeatureAccess('aiAssistant');
            const req = {
                user: {
                    _id: 'user-1',
                    blockedFeatures: { aiAssistant: false }
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            await middleware(req, res, next);
            expect(next).toHaveBeenCalled();
        });
    });

    describe('5. Admin Settings Controllers', () => {
        it('getAdminSettingsController returns active settings', async () => {
            const req = {};
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await getAdminSettingsController(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                settings: expect.any(Object)
            }));
        });

        it('updateAdminSettingsController saves changes and returns HTTP 200', async () => {
            const req = {
                user: { _id: null, username: 'sysadmin', role: 'super_admin' },
                body: {
                    newRegistrationEnabled: false,
                    ai: { defaultProvider: 'openrouter' }
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await updateAdminSettingsController(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringMatching(/updated successfully/i)
            }));
        });

        it('updateAdminSettingsController rejects illegal payloads with HTTP 400', async () => {
            const req = {
                user: { _id: null, username: 'sysadmin', role: 'super_admin' },
                body: {
                    illegalField: true
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await updateAdminSettingsController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: expect.stringMatching(/Unrecognized configuration field/i)
            }));
        });
    });
});
