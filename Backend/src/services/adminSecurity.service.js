/**
 * adminSecurity.service.js — Admin Security Hardening & Account Lockout Service
 *
 * Implements:
 * 1. Redis-backed brute-force tracking & temporary lockouts (with robust in-memory fallback).
 * 2. Login attempt threshold (5 failed attempts -> 15-minute lockout).
 * 3. OTP verification attempt threshold (5 failed attempts -> 15-minute lockout).
 * 4. Integration with Admin Audit Trail (SystemEvent) for security event logging.
 * 5. Password/credential sanitization (never logs raw passwords or OTPs).
 */

'use strict';

const { getRedisClient } = require('../config/redis');
const { recordRedisCommand } = require('../telemetry/redisMonitor');
const { recordAdminAudit } = require('./auditLog.service');

// Constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SECONDS = 900; // 15 minutes
const ATTEMPT_WINDOW_SECONDS = 900; // 15 minutes

// In-memory fallback stores
const memoryFailedAttempts = new Map();
const memoryLockouts = new Map();

/**
 * Normalizes email or identifier
 */
function normalizeIdentifier(id) {
    if (!id) return 'unknown';
    return String(id).trim().toLowerCase();
}

/**
 * Checks if an account or identifier is currently locked out
 * @param {string} identifier - Email or user identifier
 * @returns {Promise<{ isLocked: boolean, remainingSeconds: number }>}
 */
async function checkAccountLockout(identifier) {
    const cleanId = normalizeIdentifier(identifier);
    const lockKey = `auth:lockout:${cleanId}`;

    try {
        const redis = getRedisClient();
        if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
            recordRedisCommand('TTL', 'auth:lockout');
            const ttl = await redis.ttl(lockKey);
            if (ttl > 0) {
                return { isLocked: true, remainingSeconds: ttl };
            }
            if (ttl === -1) {
                // Key exists without TTL, enforce standard lockout window
                await redis.expire(lockKey, LOCKOUT_WINDOW_SECONDS);
                return { isLocked: true, remainingSeconds: LOCKOUT_WINDOW_SECONDS };
            }
            return { isLocked: false, remainingSeconds: 0 };
        }
    } catch (_) {
        // Fall back to in-memory check
    }

    // In-memory fallback
    const memLock = memoryLockouts.get(cleanId);
    if (memLock) {
        const now = Date.now();
        if (now < memLock.expiresAt) {
            const remainingSeconds = Math.ceil((memLock.expiresAt - now) / 1000);
            return { isLocked: true, remainingSeconds };
        }
        memoryLockouts.delete(cleanId);
    }

    return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Records a failed login attempt and locks account if threshold exceeded
 * @param {string} identifier - Email or username
 * @param {string} ip - Client IP
 * @param {Object} [req] - Express request object for audit logging
 * @returns {Promise<{ isLocked: boolean, remainingAttempts: number, lockoutSeconds: number }>}
 */
async function recordFailedLoginAttempt(identifier, ip = 'unknown', req = null) {
    const cleanId = normalizeIdentifier(identifier);
    const failKey = `auth:failed:${cleanId}`;
    const lockKey = `auth:lockout:${cleanId}`;

    let currentFailures = 0;
    let isRedisWorking = false;

    try {
        const redis = getRedisClient();
        if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
            recordRedisCommand('INCR', 'auth:failed');
            currentFailures = await redis.incr(failKey);
            if (currentFailures === 1) {
                recordRedisCommand('EXPIRE', 'auth:failed');
                await redis.expire(failKey, ATTEMPT_WINDOW_SECONDS);
            }
            isRedisWorking = true;
        }
    } catch (_) {
        isRedisWorking = false;
    }

    if (!isRedisWorking) {
        const now = Date.now();
        const mem = memoryFailedAttempts.get(cleanId);
        if (!mem || now > mem.resetAt) {
            currentFailures = 1;
            memoryFailedAttempts.set(cleanId, { count: 1, resetAt: now + (ATTEMPT_WINDOW_SECONDS * 1000) });
        } else {
            mem.count += 1;
            currentFailures = mem.count;
        }
    }

    if (currentFailures >= MAX_FAILED_ATTEMPTS) {
        // Lock out account
        try {
            if (isRedisWorking) {
                const redis = getRedisClient();
                recordRedisCommand('SETEX', 'auth:lockout');
                await redis.setex(lockKey, LOCKOUT_WINDOW_SECONDS, 'locked');
                await redis.del(failKey);
            }
        } catch (_) {}

        memoryLockouts.set(cleanId, {
            expiresAt: Date.now() + (LOCKOUT_WINDOW_SECONDS * 1000)
        });
        memoryFailedAttempts.delete(cleanId);

        // Security event audit log
        try {
            await recordAdminAudit({
                req,
                action: 'SECURITY_ACCOUNT_LOCKED',
                category: 'SECURITY',
                severity: 'WARN',
                targetIdentifier: cleanId,
                targetType: 'User',
                changeSummary: `Account "${cleanId}" locked for ${Math.round(LOCKOUT_WINDOW_SECONDS / 60)} minutes due to ${currentFailures} consecutive failed login attempts (IP: ${ip}).`,
                after: { lockoutSeconds: LOCKOUT_WINDOW_SECONDS, failedAttempts: currentFailures }
            });
        } catch (_) {}

        return {
            isLocked: true,
            remainingAttempts: 0,
            lockoutSeconds: LOCKOUT_WINDOW_SECONDS
        };
    }

    return {
        isLocked: false,
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - currentFailures),
        lockoutSeconds: 0
    };
}

/**
 * Clears failed attempts & lockout upon successful authentication
 * @param {string} identifier
 */
async function recordSuccessfulLogin(identifier) {
    const cleanId = normalizeIdentifier(identifier);
    const failKey = `auth:failed:${cleanId}`;
    const lockKey = `auth:lockout:${cleanId}`;

    try {
        const redis = getRedisClient();
        if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
            recordRedisCommand('DEL', 'auth:failed');
            await redis.del(failKey, lockKey);
        }
    } catch (_) {}

    memoryFailedAttempts.delete(cleanId);
    memoryLockouts.delete(cleanId);
}

/**
 * Checks OTP verification lockout status
 * @param {string} identifier
 * @returns {Promise<{ isLocked: boolean, remainingSeconds: number }>}
 */
async function checkOtpLockout(identifier) {
    const cleanId = normalizeIdentifier(identifier);
    const lockKey = `auth:otp_locked:${cleanId}`;

    try {
        const redis = getRedisClient();
        if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
            recordRedisCommand('TTL', 'auth:otp_locked');
            const ttl = await redis.ttl(lockKey);
            if (ttl > 0) return { isLocked: true, remainingSeconds: ttl };
            if (ttl === -1) {
                await redis.expire(lockKey, LOCKOUT_WINDOW_SECONDS);
                return { isLocked: true, remainingSeconds: LOCKOUT_WINDOW_SECONDS };
            }
            return { isLocked: false, remainingSeconds: 0 };
        }
    } catch (_) {}

    const memLock = memoryLockouts.get(`otp:${cleanId}`);
    if (memLock) {
        const now = Date.now();
        if (now < memLock.expiresAt) {
            return { isLocked: true, remainingSeconds: Math.ceil((memLock.expiresAt - now) / 1000) };
        }
        memoryLockouts.delete(`otp:${cleanId}`);
    }

    return { isLocked: false, remainingSeconds: 0 };
}

/**
 * Records failed OTP verification attempt
 * @param {string} identifier
 * @param {string} ip
 * @param {Object} [req]
 */
async function recordFailedOtpAttempt(identifier, ip = 'unknown', req = null) {
    const cleanId = normalizeIdentifier(identifier);
    const failKey = `auth:otp_failed:${cleanId}`;
    const lockKey = `auth:otp_locked:${cleanId}`;

    let currentFailures = 0;
    let isRedisWorking = false;

    try {
        const redis = getRedisClient();
        if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
            recordRedisCommand('INCR', 'auth:otp_failed');
            currentFailures = await redis.incr(failKey);
            if (currentFailures === 1) {
                recordRedisCommand('EXPIRE', 'auth:otp_failed');
                await redis.expire(failKey, ATTEMPT_WINDOW_SECONDS);
            }
            isRedisWorking = true;
        }
    } catch (_) {
        isRedisWorking = false;
    }

    if (!isRedisWorking) {
        const now = Date.now();
        const mem = memoryFailedAttempts.get(`otp:${cleanId}`);
        if (!mem || now > mem.resetAt) {
            currentFailures = 1;
            memoryFailedAttempts.set(`otp:${cleanId}`, { count: 1, resetAt: now + (ATTEMPT_WINDOW_SECONDS * 1000) });
        } else {
            mem.count += 1;
            currentFailures = mem.count;
        }
    }

    if (currentFailures >= MAX_FAILED_ATTEMPTS) {
        try {
            if (isRedisWorking) {
                const redis = getRedisClient();
                recordRedisCommand('SETEX', 'auth:otp_locked');
                await redis.setex(lockKey, LOCKOUT_WINDOW_SECONDS, 'locked');
                await redis.del(failKey);
            }
        } catch (_) {}

        memoryLockouts.set(`otp:${cleanId}`, {
            expiresAt: Date.now() + (LOCKOUT_WINDOW_SECONDS * 1000)
        });
        memoryFailedAttempts.delete(`otp:${cleanId}`);

        try {
            await recordAdminAudit({
                req,
                action: 'SECURITY_OTP_LOCKED',
                category: 'SECURITY',
                severity: 'WARN',
                targetIdentifier: cleanId,
                targetType: 'User',
                changeSummary: `Account "${cleanId}" OTP verification locked for ${Math.round(LOCKOUT_WINDOW_SECONDS / 60)} minutes due to ${currentFailures} failed OTP submissions (IP: ${ip}).`
            });
        } catch (_) {}

        return { isLocked: true, lockoutSeconds: LOCKOUT_WINDOW_SECONDS, remainingAttempts: 0 };
    }

    return {
        isLocked: false,
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - currentFailures),
        lockoutSeconds: 0
    };
}

/**
 * Clears OTP failed attempts and lockout upon successful OTP verification
 * @param {string} identifier
 */
async function recordSuccessfulOtp(identifier) {
    const cleanId = normalizeIdentifier(identifier);
    const failKey = `auth:otp_failed:${cleanId}`;
    const lockKey = `auth:otp_locked:${cleanId}`;

    try {
        const redis = getRedisClient();
        if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
            recordRedisCommand('DEL', 'auth:otp_failed');
            await redis.del(failKey, lockKey);
        }
    } catch (_) {}

    memoryFailedAttempts.delete(`otp:${cleanId}`);
    memoryLockouts.delete(`otp:${cleanId}`);
}

/**
 * Resets lockout manually (used in tests or admin unlock)
 * @param {string} identifier
 */
async function resetAccountLockout(identifier) {
    const cleanId = normalizeIdentifier(identifier);
    try {
        const redis = getRedisClient();
        if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
            await redis.del(
                `auth:failed:${cleanId}`,
                `auth:lockout:${cleanId}`,
                `auth:otp_failed:${cleanId}`,
                `auth:otp_locked:${cleanId}`
            );
        }
    } catch (_) {}

    memoryFailedAttempts.delete(cleanId);
    memoryLockouts.delete(cleanId);
    memoryFailedAttempts.delete(`otp:${cleanId}`);
    memoryLockouts.delete(`otp:${cleanId}`);
}

module.exports = {
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_WINDOW_SECONDS,
    checkAccountLockout,
    recordFailedLoginAttempt,
    recordSuccessfulLogin,
    checkOtpLockout,
    recordFailedOtpAttempt,
    recordSuccessfulOtp,
    resetAccountLockout
};

