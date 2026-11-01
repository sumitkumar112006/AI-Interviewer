/**
 * SystemEvent Model — Low-Overhead Admin Operational Event Log
 * Phase 5: Admin Panel Operational Event Strategy
 *
 * Captures high-importance operational, security, and administrative events for the KIVI Admin Panel.
 *
 * Design Safeguards:
 * - Does NOT store high-volume raw telemetry (raw traces/spans/logs stay in OpenTelemetry/Loki)
 * - Auto-expiring 90-day TTL index prevents unbounded MongoDB storage growth
 * - Correlated with active OpenTelemetry traceId for 1-click drilldown into Grafana/Loki
 * - Sanitized metadata strictly excludes passwords, tokens, prompts, completions, and PII
 */

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { logger, getActiveTraceContext } = require('../telemetry/logger');

const systemEventSchema = new Schema({
    eventType: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['AUTH', 'BILLING', 'SECURITY', 'SYSTEM'],
        default: 'SYSTEM',
        index: true
    },
    severity: {
        type: String,
        enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'],
        default: 'INFO',
        index: true
    },
    actorId: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        index: true
    },
    targetId: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        index: true
    },
    traceId: {
        type: String,
        trim: true,
        index: true
    },
    details: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Compound index for fast Admin Panel chronological filtering
systemEventSchema.index({ createdAt: -1, severity: 1 });

// 90-day automatic TTL index (90 * 24 * 60 * 60 = 7,776,000 seconds)
systemEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const SystemEvent = mongoose.models.SystemEvent || mongoose.model('SystemEvent', systemEventSchema);

/**
 * Non-blocking helper to record an operational event.
 * Emits to both OpenTelemetry structured logs AND MongoDB SystemEvent collection.
 */
async function recordOperationalEvent({
    eventType,
    category = 'SYSTEM',
    severity = 'INFO',
    actorId = null,
    targetId = null,
    details = {}
}) {
    const traceCtx = getActiveTraceContext();
    const traceId = traceCtx?.traceId || null;

    // 1. Emit to OpenTelemetry structured logger
    const logMethod = severity === 'ERROR' || severity === 'CRITICAL'
        ? 'error'
        : (severity === 'WARN' ? 'warn' : 'info');

    logger[logMethod](`[SystemEvent:${eventType}] ${JSON.stringify(details)}`, {
        category,
        severity,
        eventType,
        actorId: actorId ? String(actorId) : undefined,
        targetId: targetId ? String(targetId) : undefined
    });

    // 2. Persist to MongoDB (non-blocking)
    try {
        await SystemEvent.create({
            eventType,
            category,
            severity,
            actorId: actorId || undefined,
            targetId: targetId || undefined,
            traceId: traceId || undefined,
            details
        });
    } catch (err) {
        // Operational log failure must never break user request
        logger.warn(`Failed to persist SystemEvent to MongoDB: ${err.message}`, { eventType });
    }
}

module.exports = {
    SystemEvent,
    recordOperationalEvent
};

