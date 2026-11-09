/**
 * systemHealth.service.js — Centralized Operational Health Probing & Diagnostics
 *
 * Implements:
 * 1. Multi-subsystem lightweight health probes: MongoDB, Redis, BullMQ, AI Providers, Process.
 * 2. Sliding-window in-memory cache (15 seconds) to prevent redundant database/network probes.
 * 3. Total fault-isolation via Promise.allSettled — health failures never crash or disrupt other services.
 * 4. Strict secrecy: never returns credentials, connection strings, environment secrets, or raw stacks.
 * 5. Deterministic status classification: 'healthy', 'degraded', 'unavailable'.
 */

'use strict';

const mongoose = require('mongoose');
const redisConfig = require('../config/redis');
const aiQueueModule = require('../jobs/aiQueue');
const aiWorkerModule = require('../jobs/aiWorker');
const aiService = require('./ai.service');
const { SystemEvent } = require('../models/systemEvent.model');

// In-memory cache to guarantee lightweight probes
let cachedHealthReport = null;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

/**
 * Check MongoDB connection status and ping latency
 */
async function checkMongoHealth() {
    try {
        const stateCode = mongoose.connection.readyState;
        const stateMap = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        const connectionState = stateMap[stateCode] || 'unknown';

        if (stateCode !== 1) {
            return {
                status: stateCode === 2 ? 'degraded' : 'unavailable',
                connectionState,
                latencyMs: null,
                message: `Database is currently ${connectionState}.`
            };
        }

        const start = Date.now();
        if (mongoose.connection.db) {
            await mongoose.connection.db.admin().ping();
        }
        const latencyMs = Date.now() - start;

        return {
            status: latencyMs > 800 ? 'degraded' : 'healthy',
            connectionState: 'connected',
            latencyMs,
            message: latencyMs > 800 ? 'High latency detected on MongoDB connection' : 'Connected and responsive'
        };
    } catch (err) {
        return {
            status: 'unavailable',
            connectionState: 'error',
            latencyMs: null,
            message: 'Failed to communicate with MongoDB.'
        };
    }
}

/**
 * Check Redis connection status and ping latency
 */
async function checkRedisHealth() {
    try {
        const client = redisConfig.getRedisClient ? redisConfig.getRedisClient() : null;
        if (!client) {
            return {
                status: 'degraded',
                connectionState: 'fallback_memory',
                latencyMs: null,
                message: 'Redis client not initialized; in-memory fallback store is active.'
            };
        }

        const clientStatus = client.status;
        if (clientStatus !== 'ready' && clientStatus !== 'connect') {
            return {
                status: 'degraded',
                connectionState: clientStatus || 'offline',
                latencyMs: null,
                message: `Redis status is ${clientStatus}; in-memory fallback store active.`
            };
        }

        const start = Date.now();
        await client.ping();
        const latencyMs = Date.now() - start;

        return {
            status: latencyMs > 300 ? 'degraded' : 'healthy',
            connectionState: 'connected',
            clientStatus,
            latencyMs,
            message: latencyMs > 300 ? 'High roundtrip latency on Redis' : 'Connected and responsive'
        };
    } catch (err) {
        return {
            status: 'degraded',
            connectionState: 'error_fallback',
            latencyMs: null,
            message: 'Redis unreachable; in-memory fallback store is active.'
        };
    }
}

/**
 * Check BullMQ Queue backlog depth and AI Worker process state
 */
async function checkBullMQHealth() {
    try {
        let queueCounts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
        let isQueueConnected = false;

        const queue = aiQueueModule.aiQueue;
        if (queue) {
            try {
                queueCounts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
                isQueueConnected = true;
            } catch (_) {}
        }

        const worker = aiWorkerModule.getAiWorker ? aiWorkerModule.getAiWorker() : null;
        let workerState = 'idle';
        let isWorkerRunning = false;

        if (worker) {
            try {
                isWorkerRunning = typeof worker.isRunning === 'function' ? worker.isRunning() : !worker.isClosed();
                workerState = isWorkerRunning ? 'running' : (worker.isPaused?.() ? 'paused' : 'closed');
            } catch (_) {
                workerState = 'unknown';
            }
        }

        let status = 'healthy';
        let message = 'Queue and worker operational';

        if (!isWorkerRunning && queueCounts.waiting > 0) {
            status = 'degraded';
            message = 'Worker not active while jobs are queued';
        } else if (queueCounts.waiting > 100) {
            status = 'degraded';
            message = 'Elevated queue backlog';
        } else if (!isQueueConnected) {
            status = 'degraded';
            message = 'BullMQ queue metrics temporarily unavailable';
        }

        return {
            status,
            workerState,
            isWorkerRunning,
            queueCounts,
            totalBacklog: (queueCounts.waiting || 0) + (queueCounts.active || 0),
            message
        };
    } catch (err) {
        return {
            status: 'degraded',
            workerState: 'unavailable',
            isWorkerRunning: false,
            queueCounts: { waiting: 0, active: 0, completed: 0, failed: 0 },
            totalBacklog: 0,
            message: 'Could not query BullMQ status'
        };
    }
}

/**
 * Check AI Cluster Availability (Groq, Gemini, OpenRouter)
 */
async function checkAIHealth() {
    try {
        const aiStatus = aiService.getAIStatus ? aiService.getAIStatus() : { status: 'unknown' };
        const isOnline = aiStatus.status === 'online';

        return {
            status: isOnline ? 'healthy' : 'degraded',
            currentProvider: aiStatus.provider || 'None',
            primaryModel: aiStatus.primaryModel || 'Tier-based',
            fallbackModel: aiStatus.fallbackModel || 'None',
            label: aiStatus.label || 'Unknown',
            message: isOnline ? 'AI cluster online and available' : 'AI provider operating with reduced capacity'
        };
    } catch (err) {
        return {
            status: 'degraded',
            currentProvider: 'Unavailable',
            primaryModel: 'None',
            fallbackModel: 'None',
            label: 'Error checking AI status',
            message: 'AI status check failed'
        };
    }
}

/**
 * Check Node.js process runtime and heap metrics
 */
function checkProcessHealth() {
    try {
        const uptimeSeconds = Math.floor(process.uptime());
        const mem = process.memoryUsage();
        const heapUsedMB = parseFloat((mem.heapUsed / 1024 / 1024).toFixed(1));
        const heapTotalMB = parseFloat((mem.heapTotal / 1024 / 1024).toFixed(1));
        const rssMB = parseFloat((mem.rss / 1024 / 1024).toFixed(1));

        const memRatio = heapTotalMB > 0 ? (heapUsedMB / heapTotalMB) : 0;
        const status = memRatio > 0.9 ? 'degraded' : 'healthy';

        return {
            status,
            nodeVersion: process.version,
            uptimeSeconds,
            memory: {
                heapUsedMB,
                heapTotalMB,
                rssMB
            },
            env: process.env.NODE_ENV || 'development',
            message: status === 'degraded' ? 'High heap memory utilization' : 'Process running normally'
        };
    } catch (err) {
        return {
            status: 'healthy',
            nodeVersion: process.version,
            uptimeSeconds: 0,
            memory: { heapUsedMB: 0, heapTotalMB: 0, rssMB: 0 },
            env: 'production',
            message: 'Process metrics fallback'
        };
    }
}

/**
 * Fetch last 10 sanitized server errors from SystemEvent collection
 */
async function getRecentServerErrors() {
    try {
        const recentErrors = await SystemEvent.find({
            severity: { $in: ['ERROR', 'CRITICAL'] }
        })
            .select('eventType category severity traceId details createdAt')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        return recentErrors.map(err => ({
            id: err._id.toString(),
            eventType: err.eventType,
            category: err.category,
            severity: err.severity,
            traceId: err.traceId || null,
            message: err.details?.message || err.details?.action || err.eventType,
            timestamp: err.createdAt
        }));
    } catch (err) {
        return [];
    }
}

/**
 * Deterministically compute overall system health from subsystem probe results
 */
function computeOverallStatus(services) {
    if (services.mongodb?.status === 'unavailable' || services.backend?.status === 'unavailable') {
        return 'unavailable';
    }
    const hasDegraded = Object.values(services).some(s => s.status === 'degraded' || s.status === 'unavailable');
    return hasDegraded ? 'degraded' : 'healthy';
}

/**
 * Get comprehensive, fault-tolerant system health diagnostics
 * 
 * @param {Object} options - { forceLive: boolean }
 * @returns {Promise<Object>} Safe system health report
 */
async function getSystemHealth(options = {}) {
    const { forceLive = false } = options;
    const now = Date.now();

    // Check in-memory cache unless live refresh requested
    if (!forceLive && cachedHealthReport && (now - lastCacheTimestamp < CACHE_TTL_MS)) {
        return {
            ...cachedHealthReport,
            cached: true,
            cacheAgeSeconds: Math.floor((now - lastCacheTimestamp) / 1000)
        };
    }

    // Run probes concurrently with fault-isolated allSettled
    const [mongoRes, redisRes, bullmqRes, aiRes, recentErrorsRes] = await Promise.allSettled([
        checkMongoHealth(),
        checkRedisHealth(),
        checkBullMQHealth(),
        checkAIHealth(),
        getRecentServerErrors()
    ]);

    const services = {
        backend: checkProcessHealth(),
        mongodb: mongoRes.status === 'fulfilled' ? mongoRes.value : { status: 'unavailable', message: 'Probe failed' },
        redis: redisRes.status === 'fulfilled' ? redisRes.value : { status: 'degraded', message: 'Probe failed' },
        bullmq: bullmqRes.status === 'fulfilled' ? bullmqRes.value : { status: 'degraded', message: 'Probe failed' },
        ai: aiRes.status === 'fulfilled' ? aiRes.value : { status: 'degraded', message: 'Probe failed' }
    };

    const recentErrors = recentErrorsRes.status === 'fulfilled' ? recentErrorsRes.value : [];
    const overallStatus = computeOverallStatus(services);

    const report = {
        timestamp: new Date().toISOString(),
        overallStatus,
        services,
        recentErrors,
        summary: {
            healthyCount: Object.values(services).filter(s => s.status === 'healthy').length,
            degradedCount: Object.values(services).filter(s => s.status === 'degraded').length,
            unavailableCount: Object.values(services).filter(s => s.status === 'unavailable').length,
            totalSubsystems: Object.keys(services).length
        }
    };

    // Store in cache
    cachedHealthReport = report;
    lastCacheTimestamp = now;

    return {
        ...report,
        cached: false,
        cacheAgeSeconds: 0
    };
}

/**
 * Clear health cache (useful for testing)
 */
function _clearHealthCacheForTesting() {
    cachedHealthReport = null;
    lastCacheTimestamp = 0;
}

module.exports = {
    getSystemHealth,
    checkMongoHealth,
    checkRedisHealth,
    checkBullMQHealth,
    checkAIHealth,
    checkProcessHealth,
    getRecentServerErrors,
    _clearHealthCacheForTesting
};
