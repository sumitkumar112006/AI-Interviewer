/**
 * aiUsage.service.js — Centralized AI Token and Cost Tracking Service
 *
 * Implements:
 * 1. AsyncLocalStorage context propagation across async calls & background queues.
 * 2. Idempotent recording of AI usage metadata with retry deduplication.
 * 3. Sanitized error logging without prompt, completion, or sensitive user content.
 * 4. High-performance MongoDB aggregation pipelines for admin analytics.
 * 5. Caching layer (Redis + in-memory fallback) with 300s TTL.
 */

'use strict';

const { AsyncLocalStorage } = require('async_hooks');
const mongoose = require('mongoose');
const crypto = require('crypto');
const AiUsage = require('../models/aiUsage.model');
const { calculateEstimatedCost } = require('../config/aiPricing.config');
const { getCache, setCache } = require('./redis.service');

// AsyncLocalStorage instance to carry AI invocation context across execution chains
const aiContextStorage = new AsyncLocalStorage();

// Fallback in-memory cache for aggregated analytics
const memoryAnalyticsCache = new Map();
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Execute an async function within an AI context.
 *
 * @param {Object} context - { feature, userId, requestId, jobId, attempt }
 * @param {Function} fn - async () => Promise<any>
 * @returns {Promise<any>}
 */
async function runWithAiContext(context, fn) {
    const enrichedContext = {
        requestId: context?.requestId || crypto.randomUUID(),
        feature: context?.feature || 'general_ai',
        userId: context?.userId || null,
        jobId: context?.jobId || null,
        attempt: typeof context?.attempt === 'number' ? context.attempt : 1,
        ...context
    };
    return aiContextStorage.run(enrichedContext, fn);
}

/**
 * Retrieve current AI context from storage.
 *
 * @returns {Object}
 */
function getAiContext() {
    return aiContextStorage.getStore() || {};
}

/**
 * Safely sanitize error messages so no user inputs, tokens, or raw stack traces enter records.
 *
 * @param {Error|string|any} err
 * @returns {string}
 */
function sanitizeErrorMessage(err) {
    if (!err) return null;
    const msg = typeof err === 'string' ? err : (err?.message || 'AI provider execution failed');

    // Remove any accidental API keys, tokens, or URLs containing credentials
    const clean = msg
        .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]+/gi, '$1[REDACTED]')
        .replace(/(key=)[A-Za-z0-9_\-\.]+/gi, '$1[REDACTED]')
        .slice(0, 300);

    return clean.trim();
}

/**
 * Record an AI usage event into the database.
 * Thread-safe, non-blocking, and idempotent.
 *
 * @param {Object} payload
 * @returns {Promise<Object|null>}
 */
async function recordAiUsage(payload = {}) {
    const ctx = getAiContext();

    const provider = String(payload.provider || ctx.provider || 'unknown').trim();
    const model = String(payload.model || ctx.model || 'unknown').trim();
    const feature = String(payload.feature || ctx.feature || 'general_ai').trim();
    const userId = payload.userId || ctx.userId || null;
    const requestId = payload.requestId || ctx.requestId || crypto.randomUUID();
    const jobId = payload.jobId || ctx.jobId || null;
    const attempt = typeof payload.attempt === 'number' ? payload.attempt : (ctx.attempt || 1);

    const tokenCountsAvailable = payload.tokenCountsAvailable !== false;
    const inputTokens = tokenCountsAvailable && typeof payload.inputTokens === 'number' && payload.inputTokens > 0
        ? payload.inputTokens
        : 0;
    const outputTokens = tokenCountsAvailable && typeof payload.outputTokens === 'number' && payload.outputTokens > 0
        ? payload.outputTokens
        : 0;
    const totalTokens = tokenCountsAvailable && typeof payload.totalTokens === 'number' && payload.totalTokens > 0
        ? payload.totalTokens
        : (inputTokens + outputTokens);

    const status = payload.status === 'failed' ? 'failed' : 'success';
    const errorMessage = status === 'failed' ? sanitizeErrorMessage(payload.errorMessage || payload.error) : null;
    const latencyMs = typeof payload.latencyMs === 'number' && payload.latencyMs >= 0 ? payload.latencyMs : 0;

    // Calculate estimated cost using centralized pricing registry
    const estimatedCostUsd = (status === 'success' && tokenCountsAvailable)
        ? calculateEstimatedCost(model, inputTokens, outputTokens)
        : 0;

    // Generate deterministic idempotency key to prevent duplicate usage records on job retries
    const callSeq = payload.callIndex || 1;
    const idempotencyKey = payload.idempotencyKey || `${jobId || requestId}_${feature}_${attempt}_${callSeq}_${provider}_${status}`;

    // Verify DB connection before performing write
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        return null;
    }

    try {
        const doc = await AiUsage.findOneAndUpdate(
            { idempotencyKey },
            {
                $setOnInsert: {
                    provider,
                    model,
                    feature,
                    userId: mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null,
                    requestId,
                    jobId,
                    attempt,
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    tokenCountsAvailable,
                    estimatedCostUsd,
                    actualBilledCostUsd: null,
                    status,
                    errorMessage,
                    latencyMs,
                    idempotencyKey,
                    timestamp: new Date()
                }
            },
            { upsert: true, new: true }
        );

        return doc;
    } catch (err) {
        if (err.code === 11000) {
            // Duplicate key caught — expected on BullMQ retry or duplicate callback
            return null;
        }
        console.warn(`[AI Usage Service] Failed to record usage entry: ${err.message}`);
        return null;
    }
}

/**
 * Retrieve aggregated AI usage analytics via MongoDB aggregation pipelines.
 * Cached in Redis with memory fallback.
 *
 * @param {Object} options
 * @param {string} [options.startDate] - ISO date string
 * @param {string} [options.endDate] - ISO date string
 * @param {string} [options.feature] - Feature filter
 * @param {string} [options.provider] - Provider filter
 * @param {string} [options.model] - Model filter
 * @param {boolean} [options.refresh] - Force cache bypass
 * @returns {Promise<Object>}
 */
async function getAiUsageAnalytics({
    startDate,
    endDate,
    feature,
    provider,
    model,
    refresh = false
} = {}) {
    const cacheKey = `ai_usage_analytics_${startDate || 'all'}_${endDate || 'all'}_${feature || 'all'}_${provider || 'all'}_${model || 'all'}`;

    // 1. Cache hit evaluation
    if (!refresh) {
        try {
            const cached = await getCache(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (_) {}

        const memCached = memoryAnalyticsCache.get(cacheKey);
        if (memCached && memCached.expiresAt > Date.now()) {
            return memCached.data;
        }
    }

    // 2. Build match query
    const match = {};

    if (startDate || endDate) {
        match.timestamp = {};
        if (startDate) {
            const s = new Date(startDate);
            if (!isNaN(s.getTime())) match.timestamp.$gte = s;
        }
        if (endDate) {
            const e = new Date(endDate);
            if (!isNaN(e.getTime())) {
                e.setHours(23, 59, 59, 999);
                match.timestamp.$lte = e;
            }
        }
    }

    if (feature && feature !== 'all') {
        match.feature = feature;
    }
    if (provider && provider !== 'all') {
        match.provider = provider;
    }
    if (model && model !== 'all') {
        match.model = model;
    }

    // 3. Execute multi-facet aggregation pipeline
    const pipeline = [
        { $match: match },
        {
            $facet: {
                // High-level KPI metrics
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalRequests: { $sum: 1 },
                            successfulRequests: {
                                $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
                            },
                            failedRequests: {
                                $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                            },
                            totalInputTokens: { $sum: "$inputTokens" },
                            totalOutputTokens: { $sum: "$outputTokens" },
                            totalTokens: { $sum: "$totalTokens" },
                            estimatedCostUsd: { $sum: "$estimatedCostUsd" },
                            avgLatencyMs: { $avg: "$latencyMs" }
                        }
                    }
                ],

                // Breakdown by Provider and Model
                byProvider: [
                    {
                        $group: {
                            _id: { provider: "$provider", model: "$model" },
                            requests: { $sum: 1 },
                            successfulRequests: {
                                $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
                            },
                            failedRequests: {
                                $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                            },
                            totalTokens: { $sum: "$totalTokens" },
                            inputTokens: { $sum: "$inputTokens" },
                            outputTokens: { $sum: "$outputTokens" },
                            estimatedCostUsd: { $sum: "$estimatedCostUsd" },
                            avgLatencyMs: { $avg: "$latencyMs" }
                        }
                    },
                    { $sort: { requests: -1 } }
                ],

                // Breakdown by Feature / Product Area
                byFeature: [
                    {
                        $group: {
                            _id: "$feature",
                            requests: { $sum: 1 },
                            successfulRequests: {
                                $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
                            },
                            failedRequests: {
                                $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                            },
                            totalTokens: { $sum: "$totalTokens" },
                            estimatedCostUsd: { $sum: "$estimatedCostUsd" },
                            avgLatencyMs: { $avg: "$latencyMs" }
                        }
                    },
                    { $sort: { requests: -1 } }
                ],

                // Daily trends (grouped by date YYYY-MM-DD)
                dailyTrends: [
                    {
                        $group: {
                            _id: {
                                $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
                            },
                            requests: { $sum: 1 },
                            failedRequests: {
                                $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                            },
                            totalTokens: { $sum: "$totalTokens" },
                            estimatedCostUsd: { $sum: "$estimatedCostUsd" },
                            avgLatencyMs: { $avg: "$latencyMs" }
                        }
                    },
                    { $sort: { _id: 1 } },
                    { $limit: 90 }
                ],

                // Monthly trends (grouped by month YYYY-MM)
                monthlyTrends: [
                    {
                        $group: {
                            _id: {
                                $dateToString: { format: "%Y-%m", date: "$timestamp" }
                            },
                            requests: { $sum: 1 },
                            totalTokens: { $sum: "$totalTokens" },
                            estimatedCostUsd: { $sum: "$estimatedCostUsd" }
                        }
                    },
                    { $sort: { _id: 1 } },
                    { $limit: 24 }
                ]
            }
        }
    ];

    const [raw] = await AiUsage.aggregate(pipeline);

    const summaryItem = raw?.summary?.[0] || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        avgLatencyMs: 0
    };

    const formatted = {
        summary: {
            totalRequests: summaryItem.totalRequests || 0,
            successfulRequests: summaryItem.successfulRequests || 0,
            failedRequests: summaryItem.failedRequests || 0,
            totalInputTokens: summaryItem.totalInputTokens || 0,
            totalOutputTokens: summaryItem.totalOutputTokens || 0,
            totalTokens: summaryItem.totalTokens || 0,
            estimatedCostUsd: Number((summaryItem.estimatedCostUsd || 0).toFixed(4)),
            avgLatencyMs: Math.round(summaryItem.avgLatencyMs || 0)
        },
        byProvider: (raw?.byProvider || []).map(p => ({
            provider: p._id?.provider || 'unknown',
            model: p._id?.model || 'unknown',
            requests: p.requests,
            failedRequests: p.failedRequests,
            totalTokens: p.totalTokens,
            inputTokens: p.inputTokens,
            outputTokens: p.outputTokens,
            estimatedCostUsd: Number((p.estimatedCostUsd || 0).toFixed(4)),
            avgLatencyMs: Math.round(p.avgLatencyMs || 0)
        })),
        byFeature: (raw?.byFeature || []).map(f => ({
            feature: f._id || 'other',
            requests: f.requests,
            failedRequests: f.failedRequests,
            totalTokens: f.totalTokens,
            estimatedCostUsd: Number((f.estimatedCostUsd || 0).toFixed(4)),
            avgLatencyMs: Math.round(f.avgLatencyMs || 0)
        })),
        dailyTrends: (raw?.dailyTrends || []).map(d => ({
            date: d._id,
            requests: d.requests,
            failedRequests: d.failedRequests,
            totalTokens: d.totalTokens,
            estimatedCostUsd: Number((d.estimatedCostUsd || 0).toFixed(4)),
            avgLatencyMs: Math.round(d.avgLatencyMs || 0)
        })),
        monthlyTrends: (raw?.monthlyTrends || []).map(m => ({
            month: m._id,
            requests: m.requests,
            totalTokens: m.totalTokens,
            estimatedCostUsd: Number((m.estimatedCostUsd || 0).toFixed(4))
        }))
    };

    // 4. Save to caches
    try {
        await setCache(cacheKey, JSON.stringify(formatted), CACHE_TTL_SECONDS);
    } catch (_) {}

    memoryAnalyticsCache.set(cacheKey, {
        expiresAt: Date.now() + (CACHE_TTL_SECONDS * 1000),
        data: formatted
    });

    return formatted;
}

/**
 * Bounded paginated retrieval of recent AI usage logs for drill-down inspection.
 *
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function getAiUsageLogs({
    page = 1,
    limit = 20,
    status,
    provider,
    feature,
    startDate,
    endDate
} = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(5, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const match = {};
    if (status && ['success', 'failed'].includes(status)) {
        match.status = status;
    }
    if (provider && provider !== 'all') {
        match.provider = provider;
    }
    if (feature && feature !== 'all') {
        match.feature = feature;
    }

    if (startDate || endDate) {
        match.timestamp = {};
        if (startDate) {
            const s = new Date(startDate);
            if (!isNaN(s.getTime())) match.timestamp.$gte = s;
        }
        if (endDate) {
            const e = new Date(endDate);
            if (!isNaN(e.getTime())) {
                e.setHours(23, 59, 59, 999);
                match.timestamp.$lte = e;
            }
        }
    }

    const [logs, total] = await Promise.all([
        AiUsage.find(match)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limitNum)
            .select('provider model feature userId requestId jobId attempt inputTokens outputTokens totalTokens tokenCountsAvailable estimatedCostUsd status errorMessage latencyMs timestamp')
            .lean(),
        AiUsage.countDocuments(match)
    ]);

    return {
        logs,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1
        }
    };
}

module.exports = {
    runWithAiContext,
    getAiContext,
    recordAiUsage,
    getAiUsageAnalytics,
    getAiUsageLogs,
    sanitizeErrorMessage
};
