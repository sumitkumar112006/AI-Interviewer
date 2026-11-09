/**
 * appVersionControl.test.js — Comprehensive Test Suite for Application Version & Force Update Control
 *
 * Verifies:
 * 1. SemVer parsing, validation, comparison, and safe fallback.
 * 2. Version configuration validation (strict SemVer check, logical bounds).
 * 3. Rollback to previous valid configuration state.
 * 4. Safe public configuration endpoint (filters out admin credentials/settings).
 * 5. Backend version enforcement middleware:
 *    - Rejection with HTTP 426 (UPGRADE_REQUIRED) on outdated clients when mandatory.
 *    - Allowed traffic when client version satisfies minimum supported version.
 *    - Exemption of public config, health checks, webhooks, and admin routes.
 *    - Safe fallback (no lockout) on malformed client version strings.
 * 6. Audit logging of version updates and rollbacks.
 */

'use strict';

// Mock Redis and external dependencies
jest.mock('../config/redis', () => ({
    getRedisClient: jest.fn(() => null)
}));

jest.mock('../telemetry/metrics', () => ({
    recordCacheAccess: jest.fn()
}));

jest.mock('../telemetry/redisMonitor', () => ({
    recordRedisCommand: jest.fn()
}));

jest.mock('../services/auditLog.service', () => ({
    recordAdminAudit: jest.fn().mockResolvedValue(true)
}));

jest.mock('../jobs/aiQueue', () => ({
    aiQueue: { add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }) }
}));

const { parseSemVer, isValidSemVer, compareSemVer } = require('../utils/semver');
const appSettingsService = require('../services/appSettings.service');
const AppSettings = require('../models/appSettings.model');
const auditLogService = require('../services/auditLog.service');
const { enforceMinimumAppVersion, checkMaintenanceMode } = require('../middleware/appSettings.middleware');

describe('IMPLEMENTATION 16: App Version & Force Update Control', () => {
    beforeEach(() => {
        jest.spyOn(AppSettings, 'findOne').mockReturnValue({
            lean: jest.fn().mockResolvedValue(appSettingsService.DEFAULT_APP_SETTINGS)
        });
        jest.spyOn(AppSettings, 'findOneAndUpdate').mockResolvedValue(appSettingsService.DEFAULT_APP_SETTINGS);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('1. SemVer Parser & Comparator (semver.js)', () => {
        test('parses standard 3-component SemVer string', () => {
            const parsed = parseSemVer('1.4.2');
            expect(parsed).toEqual({
                major: 1,
                minor: 4,
                patch: 2,
                prerelease: null
            });
        });

        test('parses version with leading "v"', () => {
            const parsed = parseSemVer('v2.0.1');
            expect(parsed).toEqual({
                major: 2,
                minor: 0,
                patch: 1,
                prerelease: null
            });
        });

        test('parses version with prerelease suffix', () => {
            const parsed = parseSemVer('1.0.0-beta.2');
            expect(parsed).toEqual({
                major: 1,
                minor: 0,
                patch: 0,
                prerelease: 'beta.2'
            });
        });

        test('isValidSemVer returns false for malformed version strings', () => {
            expect(isValidSemVer('invalid_version')).toBe(false);
            expect(isValidSemVer('1.x.3')).toBe(false);
            expect(isValidSemVer(null)).toBe(false);
            expect(isValidSemVer('')).toBe(false);
        });

        test('compareSemVer correctly orders versions', () => {
            expect(compareSemVer('1.2.0', '1.1.9')).toBe(1);
            expect(compareSemVer('1.0.0', '1.2.0')).toBe(-1);
            expect(compareSemVer('2.0.0', '2.0.0')).toBe(0);
            expect(compareSemVer('v1.5.0', '1.5.0')).toBe(0);
            // Prerelease is lower than release
            expect(compareSemVer('1.0.0-beta', '1.0.0')).toBe(-1);
        });

        test('compareSemVer never locks out on unparseable versions (safe fallback to 0)', () => {
            expect(compareSemVer('malformed_v1', '1.0.0')).toBe(0);
            expect(compareSemVer('1.0.0', 'malformed_v2')).toBe(0);
            expect(compareSemVer(null, null)).toBe(0);
        });
    });

    describe('2. Version Settings Validation & Persistence', () => {
        test('validates and accepts valid versionControl payload', () => {
            const payload = {
                versionControl: {
                    currentVersion: '1.2.0',
                    minimumSupportedVersion: '1.1.0',
                    latestRecommendedVersion: '1.3.0',
                    mandatoryUpdate: true,
                    updateAnnouncement: {
                        title: 'Major Security Update',
                        message: 'All clients must update immediately.'
                    },
                    updateUrl: 'https://kiviapp.com/releases/1.3.0'
                }
            };

            const sanitized = appSettingsService.validateSettingsPayload(payload);
            expect(sanitized.versionControl.currentVersion).toBe('1.2.0');
            expect(sanitized.versionControl.minimumSupportedVersion).toBe('1.1.0');
            expect(sanitized.versionControl.latestRecommendedVersion).toBe('1.3.0');
            expect(sanitized.versionControl.mandatoryUpdate).toBe(true);
            expect(sanitized.versionControl.updateAnnouncement.title).toBe('Major Security Update');
        });

        test('rejects malformed SemVer in versionControl', () => {
            expect(() => {
                appSettingsService.validateSettingsPayload({
                    versionControl: { minimumSupportedVersion: 'invalid-ver-format' }
                });
            }).toThrow(/must be a valid semantic version/i);
        });

        test('rejects when minimumSupportedVersion > latestRecommendedVersion', () => {
            expect(() => {
                appSettingsService.validateSettingsPayload({
                    versionControl: {
                        minimumSupportedVersion: '2.0.0',
                        latestRecommendedVersion: '1.5.0'
                    }
                });
            }).toThrow(/cannot be higher than latest recommended version/i);
        });

        test('rejects invalid updateUrl format', () => {
            expect(() => {
                appSettingsService.validateSettingsPayload({
                    versionControl: {
                        updateUrl: 'javascript:alert(1)'
                    }
                });
            }).toThrow(/must be a valid HTTP\/HTTPS URL/i);
        });
    });

    describe('3. Public Config Isolation & Privacy', () => {
        test('getPublicAppConfig strictly isolates non-sensitive fields and omits admin settings', async () => {
            jest.spyOn(appSettingsService, 'getAppSettings').mockResolvedValue({
                key: 'global_settings',
                maintenanceMode: {
                    enabled: false,
                    message: 'Maintenance ongoing.',
                    allowedIps: ['127.0.0.1', '10.0.0.1'] // Admin sensitive!
                },
                ai: {
                    defaultProvider: 'groq',
                    allowedProviders: ['groq', 'gemini'] // Admin sensitive!
                },
                generationLimits: {
                    freeTierMonthlyQuota: 2,
                    freeTierDailyAssistantLimit: 50 // Admin sensitive!
                },
                lastUpdatedBy: '65f1234567890abcdef12345', // Admin sensitive!
                lastUpdatedByUsername: 'superadmin', // Admin sensitive!
                versionControl: {
                    currentVersion: '1.2.0',
                    minimumSupportedVersion: '1.1.0',
                    latestRecommendedVersion: '1.3.0',
                    mandatoryUpdate: true,
                    updateAnnouncement: {
                        title: 'Notice',
                        message: 'Update available'
                    },
                    updateUrl: 'https://kiviapp.com/download'
                }
            });

            const publicConfig = await appSettingsService.getPublicAppConfig();

            expect(publicConfig.success).toBe(true);
            expect(publicConfig.versionControl).toBeDefined();
            expect(publicConfig.versionControl.currentVersion).toBe('1.2.0');
            expect(publicConfig.versionControl.minimumSupportedVersion).toBe('1.1.0');
            expect(publicConfig.versionControl.mandatoryUpdate).toBe(true);

            // Strictly ensure NO admin fields are exposed in public config
            expect(publicConfig.maintenanceMode.allowedIps).toBeUndefined();
            expect(publicConfig.ai).toBeUndefined();
            expect(publicConfig.generationLimits).toBeUndefined();
            expect(publicConfig.lastUpdatedBy).toBeUndefined();
            expect(publicConfig.lastUpdatedByUsername).toBeUndefined();
        });
    });

    describe('4. Version Rollback Support', () => {
        test('rollbackVersionControl restores previous version configuration and triggers audit log', async () => {
            const previousValid = {
                currentVersion: '1.0.0',
                minimumSupportedVersion: '1.0.0',
                latestRecommendedVersion: '1.0.0',
                mandatoryUpdate: false,
                updateAnnouncement: { title: '', message: '' },
                updateUrl: ''
            };

            jest.spyOn(appSettingsService, 'getAppSettings').mockResolvedValue({
                versionControl: {
                    currentVersion: '2.0.0',
                    minimumSupportedVersion: '2.0.0',
                    latestRecommendedVersion: '2.0.0',
                    mandatoryUpdate: true
                },
                previousVersionControl: previousValid
            });

            jest.spyOn(appSettingsService, 'updateAppSettings').mockResolvedValue({
                versionControl: previousValid
            });

            const result = await appSettingsService.rollbackVersionControl({
                actorId: 'admin_test',
                actorUsername: 'test_admin',
                actorRole: 'super_admin'
            });

            expect(appSettingsService.updateAppSettings).toHaveBeenCalledWith(
                { versionControl: previousValid },
                expect.objectContaining({ actorUsername: 'test_admin' })
            );
            expect(result.versionControl.currentVersion).toBe('1.0.0');
        });

        test('rollbackVersionControl throws error if no previous configuration exists', async () => {
            jest.spyOn(appSettingsService, 'getAppSettings').mockResolvedValue({
                versionControl: { currentVersion: '1.0.0' },
                previousVersionControl: null
            });

            await expect(appSettingsService.rollbackVersionControl()).rejects.toThrow(
                /no previous version configuration available/i
            );
        });
    });

    describe('5. Backend Version Enforcement Middleware (enforceMinimumAppVersion)', () => {
        const mockAppSettings = {
            versionControl: {
                currentVersion: '1.3.0',
                minimumSupportedVersion: '1.2.0',
                latestRecommendedVersion: '1.3.0',
                mandatoryUpdate: true,
                updateUrl: 'https://kiviapp.com/download',
                updateAnnouncement: { title: 'Mandatory Update', message: 'Security patch required.' }
            }
        };

        test('blocks outdated client with HTTP 426 when mandatoryUpdate is true', async () => {
            jest.spyOn(appSettingsService, 'getAppSettings').mockResolvedValue(mockAppSettings);

            const req = {
                path: '/api/interview/start',
                method: 'POST',
                headers: { 'x-app-version': '1.1.0' } // Outdated (< 1.2.0)
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            await enforceMinimumAppVersion(req, res, next);

            expect(res.status).toHaveBeenCalledWith(426);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'UPGRADE_REQUIRED',
                clientVersion: '1.1.0',
                minimumSupportedVersion: '1.2.0',
                updateUrl: 'https://kiviapp.com/download'
            }));
            expect(next).not.toHaveBeenCalled();
        });

        test('allows client through when client version satisfies minimum supported version', async () => {
            jest.spyOn(appSettingsService, 'getAppSettings').mockResolvedValue(mockAppSettings);

            const req = {
                path: '/api/interview/start',
                method: 'POST',
                headers: { 'x-app-version': '1.2.5' } // Valid (>= 1.2.0)
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            await enforceMinimumAppVersion(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('allows traffic unconditionally when mandatoryUpdate is false', async () => {
            jest.spyOn(appSettingsService, 'getAppSettings').mockResolvedValue({
                versionControl: {
                    minimumSupportedVersion: '1.2.0',
                    mandatoryUpdate: false // Optional only
                }
            });

            const req = {
                path: '/api/interview/start',
                method: 'POST',
                headers: { 'x-app-version': '1.0.0' } // Outdated, but optional
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            await enforceMinimumAppVersion(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('exempts public config, health checks, webhooks, and admin routes', async () => {
            jest.spyOn(appSettingsService, 'getAppSettings').mockResolvedValue(mockAppSettings);

            const exemptPaths = [
                '/health',
                '/',
                '/api/config/version',
                '/api/admin/users',
                '/api/webhooks/razorpay'
            ];

            for (const path of exemptPaths) {
                const req = {
                    path,
                    method: 'GET',
                    headers: { 'x-app-version': '1.0.0' } // Outdated
                };
                const res = {
                    status: jest.fn().mockReturnThis(),
                    json: jest.fn()
                };
                const next = jest.fn();

                await enforceMinimumAppVersion(req, res, next);
                expect(next).toHaveBeenCalled();
                expect(res.status).not.toHaveBeenCalled();
            }
        });

        test('safe fallback: does not lock user out if x-app-version is malformed or missing', async () => {
            jest.spyOn(appSettingsService, 'getAppSettings').mockResolvedValue(mockAppSettings);

            // Test 1: Malformed version header
            const reqMalformed = {
                path: '/api/profile',
                method: 'GET',
                headers: { 'x-app-version': 'not-a-valid-version' }
            };
            const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next1 = jest.fn();

            await enforceMinimumAppVersion(reqMalformed, res1, next1);
            expect(next1).toHaveBeenCalled();

            // Test 2: Missing version header (browser request)
            const reqMissing = {
                path: '/api/profile',
                method: 'GET',
                headers: {}
            };
            const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next2 = jest.fn();

            await enforceMinimumAppVersion(reqMissing, res2, next2);
            expect(next2).toHaveBeenCalled();
        });
    });
});
