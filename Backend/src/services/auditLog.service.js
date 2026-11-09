'use strict';

const mongoose = require('mongoose');
const { SystemEvent } = require('../models/systemEvent.model');
const { logger, getActiveTraceContext } = require('../telemetry/logger');

// Keys that should never be logged under any circumstances
const SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /token/i,
    /jwt/i,
    /secret/i,
    /api[_-]?key/i,
    /authorization/i,
    /cookie/i,
    /otp/i,
    /hash/i,
    /cvv/i,
    /credit[_-]?card/i,
    /private[_-]?key/i
];

/**
 * Deep sanitization helper to strip sensitive credentials and truncate massive blobs.
 * @param {any} input
 * @returns {any} Sanitized clone of the input
 */
function sanitizeAuditData(input, depth = 0) {
    if (depth > 6 || input === null || input === undefined) {
        return input;
    }

    if (typeof input !== 'object') {
        return input;
    }

    if (Array.isArray(input)) {
        return input.slice(0, 50).map(item => sanitizeAuditData(item, depth + 1));
    }

    const sanitized = {};
    for (const [key, val] of Object.entries(input)) {
        // Redact matching sensitive keys
        if (SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key))) {
            sanitized[key] = '[REDACTED]';
            continue;
        }

        // Truncate massive resume HTML strings to avoid database bloat
        if ((key === 'generatedResumeHtml' || key === 'resume' || key === 'jobDescription') && typeof val === 'string') {
            sanitized[key] = val.length > 200 ? `[Text truncated: ${val.length} chars]` : val;
            continue;
        }

        sanitized[key] = sanitizeAuditData(val, depth + 1);
    }

    return sanitized;
}

/**
 * Extract clean client IP address from express request
 */
function getClientIp(req) {
    if (!req) return null;
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || null;
}

/**
 * Extract client user agent string safely
 */
function getClientUserAgent(req) {
    if (!req) return null;
    const ua = req.headers?.['user-agent'];
    return ua ? String(ua).slice(0, 300) : null;
}

/**
 * Centralized, non-blocking admin audit logging engine.
 * Records mutating actions to SystemEvent and OpenTelemetry structured logs.
 *
 * @param {Object} params
 * @param {Object} [params.req] - Express request (extracts actor, ip, ua, trace)
 * @param {string} params.action - Standard action constant (e.g. USER_SUSPENDED, ROLE_UPDATED)
 * @param {string} [params.category='ADMIN'] - Event category: ADMIN | AUTH | BILLING | SECURITY | SYSTEM
 * @param {string} [params.severity='INFO'] - Event severity: INFO | WARN | ERROR | CRITICAL
 * @param {string|Object} [params.targetId] - Target resource ObjectId if applicable
 * @param {string} [params.targetType='User'] - Target resource type (User, Admin, FeatureMatrix, etc.)
 * @param {string} [params.targetIdentifier] - Target human identifier (e.g. username, email, order ID)
 * @param {Object} [params.before] - State before mutation
 * @param {Object} [params.after] - State after mutation
 * @param {string} [params.changeSummary] - Human-readable summary of the action
 * @param {string} [params.reason] - Admin-supplied reason
 * @param {Object} [params.metadata] - Extra safe contextual metadata
 */
async function recordAdminAudit({
    req = null,
    action,
    category = 'ADMIN',
    severity = 'INFO',
    targetId = null,
    targetType = 'User',
    targetIdentifier = null,
    before = null,
    after = null,
    changeSummary = '',
    reason = null,
    metadata = {}
}) {
    try {
        if (!action) {
            logger.warn('recordAdminAudit called without an action parameter.');
            return;
        }

        // Extract Actor details
        const actorId = req?.user?._id || req?.user?.id || null;
        const actorRole = req?.user?.role || (req?.user?.isAdmin ? 'admin' : 'system');
        const ipAddress = getClientIp(req);
        const userAgent = getClientUserAgent(req);

        // Extract correlation trace ID
        const traceCtx = getActiveTraceContext();
        const traceId = traceCtx?.traceId || req?.headers?.['x-request-id'] || req?.headers?.['x-correlation-id'] || null;

        // Clean & sanitize states
        const sanitizedBefore = before ? sanitizeAuditData(before) : null;
        const sanitizedAfter = after ? sanitizeAuditData(after) : null;
        const sanitizedMetadata = metadata ? sanitizeAuditData(metadata) : {};

        const eventDetails = {
            action,
            targetType,
            targetIdentifier: targetIdentifier || (targetId ? String(targetId) : null),
            before: sanitizedBefore,
            after: sanitizedAfter,
            changeSummary: changeSummary || `${action} executed by ${actorRole}`,
            reason: reason || null,
            metadata: sanitizedMetadata
        };

        // 1. Emit to OpenTelemetry structured logger
        const logMethod = severity === 'ERROR' || severity === 'CRITICAL'
            ? 'error'
            : (severity === 'WARN' ? 'warn' : 'info');

        logger[logMethod](`[AdminAudit:${action}] ${eventDetails.changeSummary}`, {
            category,
            severity,
            action,
            actorId: actorId ? String(actorId) : 'system',
            actorRole,
            targetId: targetId ? String(targetId) : undefined,
            targetType,
            ipAddress,
            traceId
        });

        // 2. Persist to MongoDB SystemEvent collection (if database is connected)
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            await SystemEvent.create({
                eventType: action,
                category,
                severity,
                actorId: actorId || undefined,
                actorRole,
                targetId: targetId || undefined,
                targetType,
                traceId: traceId || undefined,
                ipAddress,
                userAgent,
                details: eventDetails
            });
        }

    } catch (err) {
        // Audit logging failures must never break the main request
        logger.warn(`Failed to record admin audit event "${action}": ${err.message}`);
    }
}

module.exports = {
    recordAdminAudit,
    sanitizeAuditData
};

