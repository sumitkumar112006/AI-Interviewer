/**
 * adminSecurityHardening.test.js — Test suite for IMPLEMENTATION 03 (Admin Security Hardening)
 *
 * Verifies:
 * 1. Dedicated rate limiting behavior and headers.
 * 2. Login attempt tracking & account lockout (5 failed attempts -> 15 min lock).
 * 3. OTP verification brute-force protection & lockout.
 * 4. Privilege escalation guards:
 *    - Ordinary admins cannot create super_admin accounts.
 *    - Ordinary admins cannot promote anyone to super_admin.
 *    - Ordinary admins cannot modify super_admin roles.
 *    - Ordinary admins cannot suspend or delete super_admins.
 *    - Ordinary admins cannot alter their own roles.
 * 5. Authorization middleware (requireAdmin & requireSuperAdmin).
 */

const mongoose = require('mongoose');
const { requireAdmin, requireSuperAdmin } = require('../middleware/auth.middleware');
const {
    createRateLimiter,
    adminLoginLimiter,
    otpVerifyLimiter,
    adminActionLimiter,
    adminCreationLimiter,
    adminSensitiveLimiter
} = require('../middleware/rateLimiter.middleware');
const {
    checkAccountLockout,
    recordFailedLoginAttempt,
    recordSuccessfulLogin,
    checkOtpLockout,
    recordFailedOtpAttempt,
    recordSuccessfulOtp,
    resetAccountLockout
} = require('../services/adminSecurity.service');

// Mock SystemEvent to prevent DB buffering during unit tests
jest.mock('../models/systemEvent.model', () => ({
    SystemEvent: {
        create: jest.fn().mockResolvedValue({ _id: new (require('mongoose').Types.ObjectId)() })
    }
}));

describe('IMPLEMENTATION 03 — Admin Security Hardening Test Suite', () => {

    describe('1. Authentication & Role Authorization Middleware', () => {
        test('requireAdmin: denies access (403) to unauthenticated or regular users', () => {
            const req = { user: { role: 'user', isAdmin: false } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            requireAdmin(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Administrator privileges required')
            }));
            expect(next).not.toHaveBeenCalled();
        });

        test('requireAdmin: denies access (403) to suspended/blocked admins', () => {
            const req = { user: { role: 'admin', isAdmin: true, isBlocked: true } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            requireAdmin(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(next).not.toHaveBeenCalled();
        });

        test('requireAdmin: allows legitimate admin & super_admin', () => {
            const req = { user: { role: 'admin', isAdmin: true, isBlocked: false } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            requireAdmin(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('requireSuperAdmin: denies access (403) to ordinary admins', () => {
            const req = { user: { role: 'admin', isAdmin: true } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            requireSuperAdmin(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Super Administrator privileges required')
            }));
            expect(next).not.toHaveBeenCalled();
        });

        test('requireSuperAdmin: allows super_admin role', () => {
            const req = { user: { role: 'super_admin', isAdmin: true } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            const next = jest.fn();

            requireSuperAdmin(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('2. Login Attempt Tracking & Account Lockout Defense', () => {
        const testEmail = 'attacker_target@example.com';

        beforeEach(async () => {
            await resetAccountLockout(testEmail);
        });

        test('records failed attempts and calculates remaining allowance up to 5', async () => {
            let result = await recordFailedLoginAttempt(testEmail, '127.0.0.1');
            expect(result.isLocked).toBe(false);
            expect(result.remainingAttempts).toBe(4);

            result = await recordFailedLoginAttempt(testEmail, '127.0.0.1');
            expect(result.isLocked).toBe(false);
            expect(result.remainingAttempts).toBe(3);

            result = await recordFailedLoginAttempt(testEmail, '127.0.0.1');
            expect(result.remainingAttempts).toBe(2);

            result = await recordFailedLoginAttempt(testEmail, '127.0.0.1');
            expect(result.remainingAttempts).toBe(1);
        });

        test('locks out account on 5th consecutive failed login attempt for 15 minutes', async () => {
            for (let i = 0; i < 4; i++) {
                await recordFailedLoginAttempt(testEmail, '127.0.0.1');
            }

            // 5th attempt triggers lockout
            const fifthAttempt = await recordFailedLoginAttempt(testEmail, '127.0.0.1');
            expect(fifthAttempt.isLocked).toBe(true);
            expect(fifthAttempt.lockoutSeconds).toBe(900);
            expect(fifthAttempt.remainingAttempts).toBe(0);

            // Subsequent checks confirm active lockout
            const check = await checkAccountLockout(testEmail);
            expect(check.isLocked).toBe(true);
            expect(check.remainingSeconds).toBeGreaterThan(0);
        });

        test('resets failed attempt counter upon successful login', async () => {
            await recordFailedLoginAttempt(testEmail, '127.0.0.1');
            await recordFailedLoginAttempt(testEmail, '127.0.0.1');

            await recordSuccessfulLogin(testEmail);

            const status = await checkAccountLockout(testEmail);
            expect(status.isLocked).toBe(false);

            // Next attempt should have full allowance again
            const freshAttempt = await recordFailedLoginAttempt(testEmail, '127.0.0.1');
            expect(freshAttempt.remainingAttempts).toBe(4);
        });
    });

    describe('3. OTP Verification Brute-Force Defense', () => {
        const testOtpEmail = 'otp_target@example.com';

        beforeEach(async () => {
            await resetAccountLockout(testOtpEmail);
        });

        test('locks out OTP verification after 5 incorrect OTP submissions', async () => {
            for (let i = 0; i < 4; i++) {
                const res = await recordFailedOtpAttempt(testOtpEmail, '10.0.0.1');
                expect(res.isLocked).toBe(false);
            }

            const locked = await recordFailedOtpAttempt(testOtpEmail, '10.0.0.1');
            expect(locked.isLocked).toBe(true);
            expect(locked.lockoutSeconds).toBe(900);

            const check = await checkOtpLockout(testOtpEmail);
            expect(check.isLocked).toBe(true);
            expect(check.remainingSeconds).toBeGreaterThan(0);
        });

        test('clears OTP failures after successful verification', async () => {
            await recordFailedOtpAttempt(testOtpEmail, '10.0.0.1');
            await recordSuccessfulOtp(testOtpEmail);

            const check = await checkOtpLockout(testOtpEmail);
            expect(check.isLocked).toBe(false);
        });
    });

    describe('4. Privilege Escalation Prevention in Admin Controllers', () => {
        const userModel = require('../models/user.model');
        const {
            createAdminAccountController,
            updateUserRoleController,
            toggleUserBlockController,
            deleteUserController
        } = require('../controller/admin.controller');

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('createAdminAccountController: blocks ordinary admin from creating super_admin (403)', async () => {
            const req = {
                user: { id: 'admin123', username: 'ordinary_admin', role: 'admin' },
                body: {
                    username: 'rogue_super',
                    email: 'rogue@example.com',
                    password: 'Password123!',
                    role: 'super_admin'
                }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await createAdminAccountController(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Only a Super Administrator can create a Super Administrator account')
            }));
        });

        test('updateUserRoleController: blocks ordinary admin from promoting user to super_admin (403)', async () => {
            const targetUserId = new mongoose.Types.ObjectId().toString();
            jest.spyOn(userModel, 'findById').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: targetUserId,
                    username: 'regular_bob',
                    email: 'bob@example.com',
                    role: 'user'
                })
            });

            const req = {
                user: { id: 'admin123', username: 'ordinary_admin', role: 'admin' },
                params: { userId: targetUserId },
                body: { role: 'super_admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await updateUserRoleController(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Only a Super Administrator can promote accounts to Super Administrator')
            }));
        });

        test('updateUserRoleController: blocks ordinary admin from modifying existing super_admin (403)', async () => {
            const targetUserId = new mongoose.Types.ObjectId().toString();
            jest.spyOn(userModel, 'findById').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: targetUserId,
                    username: 'chief_admin',
                    email: 'chief@example.com',
                    role: 'super_admin'
                })
            });

            const req = {
                user: { id: 'admin123', username: 'ordinary_admin', role: 'admin' },
                params: { userId: targetUserId },
                body: { role: 'admin' } // trying to demote super_admin
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await updateUserRoleController(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Only a Super Administrator can modify privileges of a Super Administrator')
            }));
        });

        test('updateUserRoleController: blocks admin from altering their own role (self-promotion)', async () => {
            const myId = new mongoose.Types.ObjectId().toString();
            jest.spyOn(userModel, 'findById').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: myId,
                    username: 'ordinary_admin',
                    email: 'admin@example.com',
                    role: 'admin'
                })
            });

            const req = {
                user: { id: myId, username: 'ordinary_admin', role: 'admin' },
                params: { userId: myId },
                body: { role: 'super_admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await updateUserRoleController(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('You cannot alter your own administrative role')
            }));
        });

        test('toggleUserBlockController: blocks ordinary admin from suspending super_admin (403)', async () => {
            const targetId = new mongoose.Types.ObjectId().toString();
            jest.spyOn(userModel, 'findById').mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: targetId,
                    username: 'boss_admin',
                    email: 'boss@example.com',
                    role: 'super_admin',
                    isBlocked: false
                })
            });

            const req = {
                user: { id: 'admin123', username: 'ordinary_admin', role: 'admin' },
                params: { userId: targetId },
                body: { isBlocked: true }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await toggleUserBlockController(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Ordinary administrators cannot suspend a Super Administrator')
            }));
        });

        test('deleteUserController: blocks ordinary admin from deleting super_admin (403)', async () => {
            const targetId = new mongoose.Types.ObjectId().toString();
            jest.spyOn(userModel, 'findById').mockResolvedValue({
                _id: targetId,
                username: 'boss_admin',
                email: 'boss@example.com',
                role: 'super_admin',
                isDeleted: false
            });

            const req = {
                user: { id: 'admin123', username: 'ordinary_admin', role: 'admin' },
                params: { userId: targetId }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await deleteUserController(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Ordinary administrators cannot delete or archive a Super Administrator')
            }));
        });
    });

    describe('5. Rate Limiting Middleware Behavior', () => {
        test('createRateLimiter attaches rate limit headers and passes allowed requests', async () => {
            const limiter = createRateLimiter({
                prefix: 'ratelimit:test:headers',
                windowSeconds: 60,
                maxRequests: 3
            });

            const req = { headers: { 'x-forwarded-for': '192.168.1.50' }, ip: '192.168.1.50' };
            const headers = {};
            const res = {
                setHeader: jest.fn((k, v) => { headers[k] = v; }),
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            await limiter(req, res, next);

            expect(headers['X-RateLimit-Limit']).toBe(3);
            expect(headers['X-RateLimit-Remaining']).toBe(2);
            expect(next).toHaveBeenCalled();
        });

        test('createRateLimiter returns 429 when maxRequests exceeded', async () => {
            const limiter = createRateLimiter({
                prefix: 'ratelimit:test:breach',
                windowSeconds: 60,
                maxRequests: 2,
                message: 'Rate limit breached'
            });

            const req = { headers: {}, ip: '192.168.1.99' };
            const headers = {};
            const res = {
                setHeader: jest.fn((k, v) => { headers[k] = v; }),
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            // Request 1: OK
            await limiter(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);

            // Request 2: OK
            await limiter(req, res, next);
            expect(next).toHaveBeenCalledTimes(2);

            // Request 3: Breached!
            await limiter(req, res, next);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Rate limit breached'
            }));
            expect(headers['Retry-After']).toBeDefined();
        });
    });
});
