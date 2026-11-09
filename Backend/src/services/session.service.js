/**
 * session.service.js — Active Session & Device Tracking Service
 *
 * Implements:
 * 1. Session creation with token hashing (never raw JWT storage).
 * 2. Two-tier fast revocation checks (Redis + MongoDB fallback).
 * 3. Throttled activity updates (lastActiveAt) to prevent database overload.
 * 4. User and Admin session revocation (single session & all user sessions).
 * 5. Safe IP masking for user views and full IP visibility for administrators.
 * 6. Audit logging for administrative session revocations.
 */

'use strict';

const crypto = require('crypto');
const Session = require('../models/session.model');
const { parseUserAgent, maskIpAddress } = require('../utils/userAgent');
const { getRedisClient } = require('../config/redis');
const { recordRedisCommand } = require('../telemetry/redisMonitor');
const auditLogService = require('./auditLog.service');

// In-Memory cache for fast touch throttling and fallback
const touchThrottleMap = new Map();
const inMemoryRevokedSessions = new Set();
const inMemoryUserRevokedBefore = new Map();

// Throttle interval for lastActiveAt DB writes (5 minutes = 300,000 ms)
const TOUCH_THROTTLE_MS = 5 * 60 * 1000;

function hashToken(token) {
    if (!token || typeof token !== 'string') return null;
    return crypto.createHash('sha256').update(token).digest('hex');
}

function extractIpAddress(req) {
    if (!req) return '127.0.0.1';
    const forwarded = req.headers ? (req.headers['x-forwarded-for'] || req.headers['x-real-ip']) : null;
    if (forwarded) {
        const parts = forwarded.split(',');
        return parts[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
}

function getClientSafely() {
    try {
        const client = getRedisClient();
        if (client && (client.status === 'ready' || client.status === 'connect')) {
            return client;
        }
        return null;
    } catch (_) {
        return null;
    }
}

/**
 * Create a new session record on login
 */
async function createSession({ userId, req, token, sessionId: customSessionId = null, expiresInMs = 24 * 60 * 60 * 1000 }) {
    const sessionId = customSessionId || `sess_${crypto.randomUUID()}`;
    const tokenHash = hashToken(token);
    const rawIp = extractIpAddress(req);
    const rawUa = req?.headers ? (req.headers['user-agent'] || '') : '';
    const { browser, os, deviceType } = parseUserAgent(rawUa);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const session = await Session.create({
        sessionId,
        userId,
        tokenHash,
        browser,
        os,
        deviceType,
        userAgent: rawUa.slice(0, 500),
        ipAddress: rawIp,
        status: 'ACTIVE',
        lastActiveAt: new Date(),
        expiresAt
    });

    // Populate Redis active cache
    const client = getClientSafely();
    if (client) {
        try {
            recordRedisCommand('SET', 'auth:session');
            const ttlSeconds = Math.max(60, Math.ceil(expiresInMs / 1000));
            await client.set(`auth:session:active:${sessionId}`, String(userId), 'EX', ttlSeconds);
        } catch (err) {
            console.error('Redis session active cache error:', err.message);
        }
    }

    return {
        sessionId,
        session
    };
}

/**
 * Efficiently touch session lastActiveAt with throttling
 */
async function touchSession(sessionId) {
    if (!sessionId) return;

    const now = Date.now();
    const lastTouch = touchThrottleMap.get(sessionId) || 0;
    if (now - lastTouch < TOUCH_THROTTLE_MS) {
        return;
    }

    touchThrottleMap.set(sessionId, now);

    try {
        await Session.updateOne(
            { sessionId, status: 'ACTIVE' },
            { $set: { lastActiveAt: new Date(now) } }
        );
    } catch (err) {
        console.error(`Error updating session lastActiveAt for ${sessionId}:`, err.message);
    }
}

/**
 * Check if a session or token has been revoked
 */
async function isSessionRevoked(sessionId, userId, tokenIat) {
    const client = getClientSafely();

    // 1. Bulk user revocation check (revoked before timestamp)
    if (userId && tokenIat) {
        const tokenIssuedAtMs = tokenIat * 1000;

        // Redis check
        if (client) {
            try {
                recordRedisCommand('GET', 'auth:user_revoked_before');
                const revokedBefore = await client.get(`auth:user_revoked_before:${userId}`);
                if (revokedBefore && tokenIssuedAtMs < parseInt(revokedBefore, 10)) {
                    return true;
                }
            } catch (err) {
                console.error('Redis user_revoked_before error:', err.message);
            }
        }

        // Memory fallback check
        const memRevokedBefore = inMemoryUserRevokedBefore.get(String(userId));
        if (memRevokedBefore && tokenIssuedAtMs < memRevokedBefore) {
            return true;
        }
    }

    // 2. If no sessionId was embedded (legacy token), it is valid unless bulk revoked
    if (!sessionId) {
        return false;
    }

    // 3. Fast Redis revocation check for specific session
    if (client) {
        try {
            recordRedisCommand('EXISTS', 'auth:session:revoked');
            const exists = await client.exists(`auth:session:revoked:${sessionId}`);
            if (exists === 1) {
                return true;
            }
        } catch (err) {
            console.error('Redis isSessionRevoked error:', err.message);
        }
    }

    // In-memory set fallback
    if (inMemoryRevokedSessions.has(sessionId)) {
        return true;
    }

    // 4. Database verification if Redis didn't flag it as revoked
    try {
        const session = await Session.findOne({ sessionId }).select('status expiresAt').lean();
        if (!session) {
            // If token has sid but no matching session exists in DB, it is invalid
            return true;
        }

        if (session.status !== 'ACTIVE' || (session.expiresAt && new Date() > new Date(session.expiresAt))) {
            // Cache revoked state in Redis and memory so we don't query Mongo again
            if (client) {
                try {
                    recordRedisCommand('SET', 'auth:session:revoked');
                    await client.set(`auth:session:revoked:${sessionId}`, '1', 'EX', 86400 * 30);
                } catch (_) {}
            }
            inMemoryRevokedSessions.add(sessionId);
            return true;
        }
    } catch (err) {
        console.error(`Database session lookup error for ${sessionId}:`, err.message);
    }

    return false;
}

/**
 * Revoke an individual session
 */
async function revokeSession(sessionId, { actorId = null, actorRole = null, isSelfRevoke = false, reason = 'User initiated revocation', req = null } = {}) {
    if (!sessionId) return false;

    // Fast-cache revocation state in Redis and memory
    const client = getClientSafely();
    if (client) {
        try {
            recordRedisCommand('SET', 'auth:session:revoked');
            await client.set(`auth:session:revoked:${sessionId}`, '1', 'EX', 86400 * 30);
            await client.del(`auth:session:active:${sessionId}`);
        } catch (err) {
            console.error('Redis revokeSession error:', err.message);
        }
    }
    inMemoryRevokedSessions.add(sessionId);

    // Update MongoDB
    const now = new Date();
    const updated = await Session.findOneAndUpdate(
        { sessionId, status: 'ACTIVE' },
        {
            $set: {
                status: 'REVOKED',
                revokedAt: now,
                revokedBy: actorId || (isSelfRevoke ? 'USER' : 'SYSTEM'),
                revocationReason: reason
            }
        },
        { new: true }
    );

    // Audit log if performed by an administrator
    if (req && actorRole && ['admin', 'super_admin'].includes(actorRole) && !isSelfRevoke) {
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'SESSION_REVOKED',
                category: 'SECURITY',
                severity: 'MEDIUM',
                targetId: updated?.userId || sessionId,
                targetType: 'Session',
                targetIdentifier: sessionId,
                changeSummary: `Administrator revoked active session "${sessionId}". Reason: ${reason}`
            });
        } catch (auditErr) {
            console.error('Audit log error on session revoke:', auditErr.message);
        }
    }

    return !!updated;
}

/**
 * Revoke all active sessions for a user (or all except current)
 */
async function revokeAllUserSessions(userId, { actorId = null, actorRole = null, isSelfRevoke = false, reason = 'Revoke all sessions', exceptSessionId = null, req = null } = {}) {
    if (!userId) return 0;

    const query = { userId, status: 'ACTIVE' };
    if (exceptSessionId) {
        query.sessionId = { $ne: exceptSessionId };
    }

    const activeSessions = await Session.find(query).select('sessionId').lean();
    if (!activeSessions || activeSessions.length === 0) {
        return 0;
    }

    const sessionIds = activeSessions.map(s => s.sessionId);
    const now = new Date();

    // 1. Bulk update MongoDB
    const updateResult = await Session.updateMany(
        { sessionId: { $in: sessionIds } },
        {
            $set: {
                status: 'REVOKED',
                revokedAt: now,
                revokedBy: actorId || (isSelfRevoke ? 'USER' : 'SYSTEM'),
                revocationReason: reason
            }
        }
    );

    // 2. Set Redis keys
    const client = getClientSafely();
    for (const sid of sessionIds) {
        inMemoryRevokedSessions.add(sid);
        if (client) {
            try {
                recordRedisCommand('SET', 'auth:session:revoked');
                await client.set(`auth:session:revoked:${sid}`, '1', 'EX', 86400 * 30);
                await client.del(`auth:session:active:${sid}`);
            } catch (_) {}
        }
    }

    // If revoking ALL without exception, update user-level revoked timestamp
    if (!exceptSessionId) {
        const revokedTimestamp = Date.now();
        inMemoryUserRevokedBefore.set(String(userId), revokedTimestamp);
        if (client) {
            try {
                recordRedisCommand('SET', 'auth:user_revoked_before');
                await client.set(`auth:user_revoked_before:${userId}`, String(revokedTimestamp), 'EX', 86400 * 30);
            } catch (_) {}
        }
    }

    // 3. Audit log for admin action
    if (req && actorRole && ['admin', 'super_admin'].includes(actorRole) && !isSelfRevoke) {
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'ALL_SESSIONS_REVOKED',
                category: 'SECURITY',
                severity: 'HIGH',
                targetId: userId,
                targetType: 'UserAccount',
                targetIdentifier: String(userId),
                changeSummary: `Administrator revoked all ${updateResult.modifiedCount} active sessions for user ${userId}. Reason: ${reason}`
            });
        } catch (auditErr) {
            console.error('Audit log error on revokeAllUserSessions:', auditErr.message);
        }
    }

    return updateResult.modifiedCount;
}

/**
 * Get active sessions for a user (masked IP for user, unmasked for admin)
 */
async function getUserActiveSessions(userId, currentSessionId = null, isFullAdmin = false) {
    if (!userId) return [];

    const sessions = await Session.find({ userId, status: 'ACTIVE' })
        .sort({ lastActiveAt: -1 })
        .lean();

    return sessions.map(session => ({
        sessionId: session.sessionId,
        browser: session.browser || 'Unknown Browser',
        os: session.os || 'Unknown OS',
        deviceType: session.deviceType || 'unknown',
        ipAddress: isFullAdmin ? session.ipAddress : maskIpAddress(session.ipAddress),
        lastActiveAt: session.lastActiveAt,
        createdAt: session.createdAt,
        status: session.status,
        isCurrent: Boolean(currentSessionId && session.sessionId === currentSessionId)
    }));
}

/**
 * Get session history for administrative inspection
 */
async function getAdminUserSessions(userId, currentSessionId = null, { status = 'ALL' } = {}) {
    if (!userId) return [];

    const filter = { userId };
    if (status && status !== 'ALL') {
        filter.status = status;
    }

    const sessions = await Session.find(filter)
        .sort({ lastActiveAt: -1 })
        .limit(50)
        .lean();

    return sessions.map(session => ({
        sessionId: session.sessionId,
        browser: session.browser || 'Unknown Browser',
        os: session.os || 'Unknown OS',
        deviceType: session.deviceType || 'unknown',
        ipAddress: session.ipAddress, // Full IP for admin
        userAgent: session.userAgent,
        status: session.status,
        lastActiveAt: session.lastActiveAt,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
        revokedBy: session.revokedBy,
        revocationReason: session.revocationReason,
        isCurrent: Boolean(currentSessionId && session.sessionId === currentSessionId)
    }));
}

module.exports = {
    createSession,
    touchSession,
    isSessionRevoked,
    revokeSession,
    revokeAllUserSessions,
    getUserActiveSessions,
    getAdminUserSessions,
    hashToken,
    extractIpAddress
};
