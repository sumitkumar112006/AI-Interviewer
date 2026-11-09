/**
 * sessionManagement.test.js — Comprehensive Test Suite for Session & Device Management
 *
 * Verifies:
 * 1. User-Agent parsing and IP masking privacy guarantees.
 * 2. Token security: SHA-256 hashing (zero raw JWT storage in DB).
 * 3. Session lifecycle: creation, active status, Redis cache synchronization.
 * 4. Fast revocation check (Redis + MongoDB fallback).
 * 5. Single session revocation & bulk user session revocation.
 * 6. IP visibility: masked for regular user view, full for authorized admin view.
 * 7. Middleware enforcement: authUser blocks revoked sessions and respects legacy tokens.
 * 8. Controller security: ownership verification prevents revoking other users' sessions.
 */

'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Mock dependencies
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

jest.mock('../services/userActivity.service', () => ({
    touchUserActivity: jest.fn(),
    recordUserActivity: jest.fn().mockResolvedValue(true)
}));

const { parseUserAgent, maskIpAddress } = require('../utils/userAgent');
const sessionService = require('../services/session.service');
const Session = require('../models/session.model');
const userModel = require('../models/user.model');
const blacklistModel = require('../models/blacklist_model');
const { authUser } = require('../middleware/auth.middleware');
const sessionController = require('../controller/session.controller');
const auditLogService = require('../services/auditLog.service');

describe('IMPLEMENTATION 15: Session and Device Management', () => {
    const JWT_SECRET = 'test_jwt_secret_key_12345';
    beforeAll(() => {
        process.env.JWT_SECRET = JWT_SECRET;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('1. Device Parsing & IP Masking (userAgent.js)', () => {
        test('identifies desktop browser and OS from Chrome User-Agent', () => {
            const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            const parsed = parseUserAgent(ua);

            expect(parsed.deviceType).toBe('desktop');
            expect(parsed.browser).toBe('Google Chrome');
            expect(parsed.os).toBe('Windows 10/11');
        });

        test('identifies mobile device from iPhone Safari User-Agent', () => {
            const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
            const parsed = parseUserAgent(ua);

            expect(parsed.deviceType).toBe('mobile');
            expect(parsed.os).toBe('iOS');
            expect(parsed.browser).toBe('Apple Safari');
        });

        test('identifies tablet device from iPad User-Agent', () => {
            const ua = 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
            const parsed = parseUserAgent(ua);

            expect(parsed.deviceType).toBe('tablet');
            expect(parsed.os).toBe('iOS');
        });

        test('handles missing or malformed User-Agent gracefully', () => {
            const parsed = parseUserAgent(null);
            expect(parsed.browser).toBe('Unknown Browser');
            expect(parsed.deviceType).toBe('unknown');
        });

        test('masks IPv4 address for privacy', () => {
            expect(maskIpAddress('192.168.1.150')).toBe('192.168.***.***');
            expect(maskIpAddress('49.36.12.88')).toBe('49.36.***.***');
        });

        test('masks IPv6 address for privacy', () => {
            expect(maskIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:****:****');
        });

        test('handles invalid IP gracefully', () => {
            expect(maskIpAddress(null)).toBe('***.***.***.***');
            expect(maskIpAddress('')).toBe('***.***.***.***');
        });
    });

    describe('2. Token Security: Cryptographic Hashing', () => {
        test('hashes raw JWT with SHA-256 and never returns raw token', () => {
            const sampleToken = 'header.payload.signature_xyz';
            const expectedHash = crypto.createHash('sha256').update(sampleToken).digest('hex');

            const tokenHash = sessionService.hashToken(sampleToken);
            expect(tokenHash).toBe(expectedHash);
            expect(tokenHash).not.toContain(sampleToken);
        });

        test('hashToken returns null for empty/invalid token', () => {
            expect(sessionService.hashToken(null)).toBeNull();
            expect(sessionService.hashToken('')).toBeNull();
        });
    });

    describe('3. Session Service: Creation & Lifecycle', () => {
        const mockUserId = '507f1f77bcf86cd799439011';

        test('createSession stores hashed token and device metadata', async () => {
            const mockReq = {
                ip: '103.21.244.2',
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            };
            const mockToken = 'mock.jwt.token_123';

            jest.spyOn(Session, 'create').mockResolvedValue({
                sessionId: 'sess_12345',
                userId: mockUserId,
                tokenHash: crypto.createHash('sha256').update(mockToken).digest('hex'),
                browser: 'Google Chrome',
                os: 'Windows 10/11',
                deviceType: 'desktop',
                ipAddress: '103.21.244.2',
                status: 'ACTIVE'
            });

            const result = await sessionService.createSession({
                userId: mockUserId,
                req: mockReq,
                token: mockToken,
                sessionId: 'sess_12345'
            });

            expect(result.sessionId).toBe('sess_12345');
            expect(Session.create).toHaveBeenCalledWith(expect.objectContaining({
                sessionId: 'sess_12345',
                userId: mockUserId,
                status: 'ACTIVE',
                deviceType: 'desktop',
                browser: 'Google Chrome'
            }));
        });

        test('isSessionRevoked returns false for valid active session', async () => {
            jest.spyOn(Session, 'findOne').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        sessionId: 'sess_active',
                        status: 'ACTIVE',
                        expiresAt: new Date(Date.now() + 86400000)
                    })
                })
            });

            const isRevoked = await sessionService.isSessionRevoked('sess_active', mockUserId, Math.floor(Date.now() / 1000));
            expect(isRevoked).toBe(false);
        });

        test('isSessionRevoked returns true when session marked REVOKED in DB', async () => {
            jest.spyOn(Session, 'findOne').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue({
                        sessionId: 'sess_revoked',
                        status: 'REVOKED',
                        expiresAt: new Date(Date.now() + 86400000)
                    })
                })
            });

            const isRevoked = await sessionService.isSessionRevoked('sess_revoked', mockUserId, Math.floor(Date.now() / 1000));
            expect(isRevoked).toBe(true);
        });

        test('isSessionRevoked returns false for legacy tokens without sid', async () => {
            const isRevoked = await sessionService.isSessionRevoked(null, mockUserId, Math.floor(Date.now() / 1000));
            expect(isRevoked).toBe(false);
        });
    });

    describe('4. Session Revocation (Single & Bulk)', () => {
        const mockUserId = '507f1f77bcf86cd799439011';

        test('revokeSession marks session REVOKED and logs admin audit when admin revokes', async () => {
            const sessionId = 'sess_target_to_revoke';
            jest.spyOn(Session, 'findOneAndUpdate').mockResolvedValue({
                sessionId,
                userId: mockUserId,
                status: 'REVOKED'
            });

            const mockReq = { ip: '127.0.0.1' };
            const success = await sessionService.revokeSession(sessionId, {
                actorId: 'admin_id_99',
                actorRole: 'admin',
                isSelfRevoke: false,
                reason: 'Suspicious device location',
                req: mockReq
            });

            expect(success).toBe(true);
            expect(Session.findOneAndUpdate).toHaveBeenCalledWith(
                { sessionId, status: 'ACTIVE' },
                expect.objectContaining({
                    $set: expect.objectContaining({
                        status: 'REVOKED',
                        revocationReason: 'Suspicious device location'
                    })
                }),
                { new: true }
            );

            expect(auditLogService.recordAdminAudit).toHaveBeenCalledWith(expect.objectContaining({
                action: 'SESSION_REVOKED',
                targetIdentifier: sessionId
            }));
        });

        test('revokeAllUserSessions revokes all sessions except current session', async () => {
            const activeSessions = [
                { sessionId: 'sess_other_1' },
                { sessionId: 'sess_other_2' }
            ];

            jest.spyOn(Session, 'find').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(activeSessions)
                })
            });

            jest.spyOn(Session, 'updateMany').mockResolvedValue({
                modifiedCount: 2
            });

            const count = await sessionService.revokeAllUserSessions(mockUserId, {
                actorId: mockUserId,
                isSelfRevoke: true,
                exceptSessionId: 'sess_current'
            });

            expect(count).toBe(2);
            expect(Session.find).toHaveBeenCalledWith({
                userId: mockUserId,
                status: 'ACTIVE',
                sessionId: { $ne: 'sess_current' }
            });
            expect(Session.updateMany).toHaveBeenCalled();
        });
    });

    describe('5. IP Visibility: User vs Admin Views', () => {
        const mockUserId = '507f1f77bcf86cd799439011';
        const rawSessions = [
            {
                sessionId: 'sess_1',
                browser: 'Google Chrome',
                os: 'Windows 10/11',
                deviceType: 'desktop',
                ipAddress: '103.25.10.88',
                status: 'ACTIVE',
                createdAt: new Date(),
                lastActiveAt: new Date()
            }
        ];

        test('getUserActiveSessions masks IP for standard users', async () => {
            jest.spyOn(Session, 'find').mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(rawSessions)
                })
            });

            const sessions = await sessionService.getUserActiveSessions(mockUserId, 'sess_1', false);
            expect(sessions[0].ipAddress).toBe('103.25.***.***');
            expect(sessions[0].isCurrent).toBe(true);
        });

        test('getUserActiveSessions retains full IP when isFullAdmin is true', async () => {
            jest.spyOn(Session, 'find').mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue(rawSessions)
                })
            });

            const sessions = await sessionService.getUserActiveSessions(mockUserId, 'sess_1', true);
            expect(sessions[0].ipAddress).toBe('103.25.10.88');
        });
    });

    describe('6. Middleware: authUser Enforcement', () => {
        const mockUserId = '507f1f77bcf86cd799439011';

        test('blocks request with 401 when session has been revoked', async () => {
            const token = jwt.sign(
                { id: mockUserId, username: 'testuser', sid: 'sess_blocked' },
                JWT_SECRET
            );

            const req = { cookies: { token } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            jest.spyOn(sessionService, 'isSessionRevoked').mockResolvedValue(true);

            await authUser(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                sessionRevoked: true
            }));
            expect(next).not.toHaveBeenCalled();
        });

        test('allows valid active session and attaches req.sessionId', async () => {
            const token = jwt.sign(
                { id: mockUserId, username: 'testuser', sid: 'sess_valid' },
                JWT_SECRET
            );

            const req = { cookies: { token } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            jest.spyOn(sessionService, 'isSessionRevoked').mockResolvedValue(false);
            jest.spyOn(blacklistModel, 'findOne').mockResolvedValue(null);
            jest.spyOn(userModel, 'findById').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: mockUserId,
                    username: 'testuser',
                    email: 'test@example.com',
                    role: 'user',
                    plan: 'free',
                    isBlocked: false
                })
            });

            await authUser(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.sessionId).toBe('sess_valid');
        });

        test('allows legacy token without sid (backward compatibility)', async () => {
            const token = jwt.sign(
                { id: mockUserId, username: 'legacyuser' },
                JWT_SECRET
            );

            const req = { cookies: { token } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            jest.spyOn(sessionService, 'isSessionRevoked').mockResolvedValue(false);
            jest.spyOn(blacklistModel, 'findOne').mockResolvedValue(null);
            jest.spyOn(userModel, 'findById').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: mockUserId,
                    username: 'legacyuser',
                    email: 'legacy@example.com',
                    role: 'user',
                    plan: 'free',
                    isBlocked: false
                })
            });

            await authUser(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.sessionId).toBeNull();
        });
    });

    describe('7. Controller Security: Ownership Verification', () => {
        const callerUserId = '507f1f77bcf86cd799439011';
        const otherUserId = '507f1f77bcf86cd799439022';

        test('revokeUserSessionController returns 403 when user tries to revoke another user session', async () => {
            const req = {
                user: { id: callerUserId },
                params: { sessionId: 'sess_victim' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            jest.spyOn(Session, 'findOne').mockResolvedValue({
                sessionId: 'sess_victim',
                userId: otherUserId, // belongs to another user!
                status: 'ACTIVE'
            });

            await sessionController.revokeUserSessionController(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringMatching(/not authorized/i)
            }));
        });

        test('revokeUserSessionController successfully revokes session if caller owns it', async () => {
            const req = {
                user: { id: callerUserId },
                params: { sessionId: 'sess_own' },
                sessionId: 'sess_own'
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
                clearCookie: jest.fn()
            };

            jest.spyOn(Session, 'findOne').mockResolvedValue({
                sessionId: 'sess_own',
                userId: callerUserId,
                status: 'ACTIVE'
            });
            jest.spyOn(sessionService, 'revokeSession').mockResolvedValue(true);

            await sessionController.revokeUserSessionController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.clearCookie).toHaveBeenCalledWith('token', expect.any(Object));
        });

        test('revokeOtherSessionsController calls service with exceptSessionId', async () => {
            const req = {
                user: { id: callerUserId },
                sessionId: 'sess_current'
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            jest.spyOn(sessionService, 'revokeAllUserSessions').mockResolvedValue(3);

            await sessionController.revokeOtherSessionsController(req, res);

            expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith(
                callerUserId,
                expect.objectContaining({
                    isSelfRevoke: true,
                    exceptSessionId: 'sess_current'
                })
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                revokedCount: 3
            }));
        });
    });
});
