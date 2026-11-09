/**
 * userActivity.service.js — High-Performance User Activity Tracking & Telemetry
 *
 * Implements:
 * 1. Efficient authenticated activity tracking with two-tier throttling (Node.js in-memory + Redis).
 * 2. Guaranteed avoidance of redundant MongoDB writes (at most 1 write per user per 5-minute window).
 * 3. Graceful degradation when Redis is offline or disconnected.
 * 4. Zero tracking of keystrokes, browsing history, or sensitive payload data.
 * 5. Multi-dimensional analytics: DAU, WAU, MAU, Dormant, New Registrations, and Returning Users.
 * 6. High-throughput single-pass MongoDB aggregation pipelines for dashboard metrics.
 */

'use strict';

const mongoose = require('mongoose');
const userModel = require('../models/user.model');
const redisConfig = require('../config/redis');

// Throttling configuration: 5 minutes (300 seconds)
const THROTTLE_WINDOW_SECONDS = 300;
const THROTTLE_WINDOW_MS = THROTTLE_WINDOW_SECONDS * 1000;

// In-memory cache for Tier 1 ultra-fast local throttling (prevents Redis network roundtrips)
// Structure: Map<userIdString, lastRecordedTimestampMs>
const localActivityCache = new Map();
const MAX_CACHE_ENTRIES = 50000;

// Periodic cleanup of stale memory cache entries (every 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of localActivityCache.entries()) {
        if (now - timestamp > THROTTLE_WINDOW_MS * 2) {
            localActivityCache.delete(userId);
        }
    }
}, 10 * 60 * 1000).unref?.();

/**
 * Safe helper to obtain ready Redis client
 */
function getClientSafely() {
    try {
        const client = redisConfig.getRedisClient ? redisConfig.getRedisClient() : null;
        if (client && (client.status === 'ready' || client.status === 'connect')) {
            return client;
        }
        return null;
    } catch (_) {
        return null;
    }
}

/**
 * Record user activity with two-tier throttling
 * 
 * @param {string|mongoose.Types.ObjectId} userId - User identifier
 * @param {Object} options - Options { force: boolean, activityDate: Date }
 * @returns {Promise<boolean>} - True if database write was executed, False if throttled
 */
async function recordUserActivity(userId, options = {}) {
    if (!userId) return false;

    const idStr = userId.toString();
    const now = options.activityDate ? new Date(options.activityDate).getTime() : Date.now();
    const force = Boolean(options.force);

    // Tier 1: In-memory cache check (Cost: ~0.001ms)
    if (!force) {
        const lastLocalTimestamp = localActivityCache.get(idStr);
        if (lastLocalTimestamp && (now - lastLocalTimestamp < THROTTLE_WINDOW_MS)) {
            // Throttled in-memory: zero Redis and zero MongoDB overhead
            return false;
        }
    }

    // Tier 2: Redis distributed check across multiple instances (Cost: ~1ms)
    const redisKey = `activity:user:${idStr}`;
    const redisClient = getClientSafely();

    if (!force && redisClient) {
        try {
            const exists = await redisClient.get(redisKey);
            if (exists) {
                // Another node or previous request updated Redis; sync local cache and throttle
                localActivityCache.set(idStr, now);
                return false;
            }
        } catch (err) {
            // Non-fatal Redis warning; proceed to local fallback
            console.warn('[USER_ACTIVITY] Redis read fallback:', err.message);
        }
    }

    // Update in-memory cache
    if (localActivityCache.size >= MAX_CACHE_ENTRIES) {
        // Simple evict oldest entry if size limit reached
        const firstKey = localActivityCache.keys().next().value;
        if (firstKey) localActivityCache.delete(firstKey);
    }
    localActivityCache.set(idStr, now);

    // Update Redis key with TTL
    if (redisClient) {
        try {
            await redisClient.set(redisKey, now.toString(), 'EX', THROTTLE_WINDOW_SECONDS);
        } catch (err) {
            console.warn('[USER_ACTIVITY] Redis write fallback:', err.message);
        }
    }

    // Tier 3: Asynchronous MongoDB write
    try {
        await userModel.updateOne(
            { _id: userId },
            { $set: { lastActiveAt: new Date(now) } }
        ).exec();
        return true;
    } catch (err) {
        console.error('[USER_ACTIVITY] Failed to persist lastActiveAt to MongoDB:', err.message);
        return false;
    }
}

/**
 * Fire-and-forget helper for authentication middleware
 * Does not block HTTP response flow
 */
function touchUserActivity(userId) {
    if (!userId) return;
    setImmediate(() => {
        recordUserActivity(userId, { force: false }).catch(() => {});
    });
}

/**
 * Metric definitions dictionary for transparent admin compliance
 */
const ACTIVITY_METRIC_DEFINITIONS = Object.freeze({
    DAU: {
        name: 'Daily Active Users (DAU)',
        definition: 'Distinct non-deleted users who performed at least one authenticated request since 00:00:00 today.',
        window: 'Today (Since 00:00:00 local/UTC)'
    },
    WAU: {
        name: 'Weekly Active Users (WAU)',
        definition: 'Distinct non-deleted users with authenticated activity in the last 7 calendar days.',
        window: 'Last 7 Days (Rolling)'
    },
    MAU: {
        name: 'Monthly Active Users (MAU)',
        definition: 'Distinct non-deleted users with authenticated activity in the last 30 calendar days.',
        window: 'Last 30 Days (Rolling)'
    },
    DORMANT: {
        name: 'Dormant Users',
        definition: 'Registered, non-deleted users with no authenticated activity in the last 30 days, or legacy accounts created >30 days ago that have never logged in.',
        window: 'Older than 30 Days'
    },
    NEW_REGISTRATIONS: {
        name: 'New Registrations',
        definition: 'Accounts created within the selected analytics evaluation window.',
        window: 'Within Evaluation Window'
    },
    RETURNING_USERS: {
        name: 'Returning Users',
        definition: 'Retained users who were active during the evaluation window, but registered prior to that window.',
        window: 'Active in Window, Registered Before Window'
    },
    NEVER_ACTIVE: {
        name: 'Never Active / Legacy Unused',
        definition: 'Accounts with no recorded lastActiveAt timestamp since tracking was initialized.',
        window: 'All Time'
    }
});

/**
 * Calculate comprehensive user activity analytics for Admin Overview & Reports
 * 
 * @param {Object} options - { timeframe: '7d'|'30d'|'90d', plan: 'all'|'free'|'pro'|'premium' }
 * @returns {Promise<Object>} Aggregated activity analytics
 */
async function getUserActivityAnalytics(options = {}) {
    const { timeframe = '30d', plan = 'all' } = options;

    const now = new Date();

    // Calculate boundary timestamps
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));

    let windowStart = thirtyDaysAgo;
    let daysCount = 30;
    if (timeframe === '7d') {
        windowStart = sevenDaysAgo;
        daysCount = 7;
    } else if (timeframe === '90d') {
        windowStart = ninetyDaysAgo;
        daysCount = 90;
    }

    // Helper for ObjectId timestamp comparison on legacy records missing createdAt
    const windowStartHex = Math.floor(windowStart.getTime() / 1000).toString(16).padEnd(24, '0');
    const windowStartObjectId = new mongoose.Types.ObjectId(windowStartHex);

    const thirtyDaysHex = Math.floor(thirtyDaysAgo.getTime() / 1000).toString(16).padEnd(24, '0');
    const thirtyDaysObjectId = new mongoose.Types.ObjectId(thirtyDaysHex);

    // Build base filter
    const baseMatch = { isDeleted: { $ne: true } };
    if (plan && plan !== 'all') {
        baseMatch.plan = plan.toLowerCase();
    }

    // High-performance single-pass aggregation with $facet
    const aggResults = await userModel.aggregate([
        { $match: baseMatch },
        {
            $facet: {
                totalUsers: [{ $count: 'count' }],
                dau: [
                    { $match: { lastActiveAt: { $gte: startOfToday } } },
                    { $count: 'count' }
                ],
                wau: [
                    { $match: { lastActiveAt: { $gte: sevenDaysAgo } } },
                    { $count: 'count' }
                ],
                mau: [
                    { $match: { lastActiveAt: { $gte: thirtyDaysAgo } } },
                    { $count: 'count' }
                ],
                dormant: [
                    {
                        $match: {
                            $or: [
                                { lastActiveAt: { $lt: thirtyDaysAgo } },
                                {
                                    lastActiveAt: null,
                                    $or: [
                                        { createdAt: { $lt: thirtyDaysAgo } },
                                        { createdAt: null, _id: { $lt: thirtyDaysObjectId } }
                                    ]
                                }
                            ]
                        }
                    },
                    { $count: 'count' }
                ],
                newRegistrations: [
                    {
                        $match: {
                            $or: [
                                { createdAt: { $gte: windowStart } },
                                { createdAt: null, _id: { $gte: windowStartObjectId } }
                            ]
                        }
                    },
                    { $count: 'count' }
                ],
                returningUsers: [
                    {
                        $match: {
                            lastActiveAt: { $gte: windowStart },
                            $or: [
                                { createdAt: { $lt: windowStart } },
                                { createdAt: null, _id: { $lt: windowStartObjectId } }
                            ]
                        }
                    },
                    { $count: 'count' }
                ],
                neverActive: [
                    { $match: { lastActiveAt: null } },
                    { $count: 'count' }
                ],
                planBreakdown: [
                    {
                        $group: {
                            _id: { $ifNull: ['$plan', 'free'] },
                            total: { $sum: 1 },
                            activeMau: {
                                $sum: {
                                    $cond: [{ $gte: ['$lastActiveAt', thirtyDaysAgo] }, 1, 0]
                                }
                            },
                            activeDau: {
                                $sum: {
                                    $cond: [{ $gte: ['$lastActiveAt', startOfToday] }, 1, 0]
                                }
                            }
                        }
                    }
                ]
            }
        }
    ]);

    const facetResults = aggResults?.[0] || {};
    const totalUsers = facetResults.totalUsers?.[0]?.count || 0;
    const dau = facetResults.dau?.[0]?.count || 0;
    const wau = facetResults.wau?.[0]?.count || 0;
    const mau = facetResults.mau?.[0]?.count || 0;
    const dormant = facetResults.dormant?.[0]?.count || 0;
    const newInWindow = facetResults.newRegistrations?.[0]?.count || 0;
    const returningInWindow = facetResults.returningUsers?.[0]?.count || 0;
    const neverActive = facetResults.neverActive?.[0]?.count || 0;

    // Daily active users timeline (trend over requested window)
    const trendStartDate = new Date(now.getTime() - (daysCount * 24 * 60 * 60 * 1000));
    trendStartDate.setHours(0, 0, 0, 0);

    const dailyActiveAgg = await userModel.aggregate([
        {
            $match: {
                ...baseMatch,
                lastActiveAt: { $gte: trendStartDate }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastActiveAt' } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const activeMap = new Map(dailyActiveAgg.map(r => [r._id, r.count]));
    const dailyActiveTrend = [];
    for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dailyActiveTrend.push({
            date: dateStr,
            activeCount: activeMap.get(dateStr) || 0
        });
    }

    // Format plan breakdown nicely
    const plans = {
        free: { total: 0, activeMau: 0, activeDau: 0 },
        pro: { total: 0, activeMau: 0, activeDau: 0 },
        premium: { total: 0, activeMau: 0, activeDau: 0 }
    };
    (facetResults.planBreakdown || []).forEach(p => {
        const key = (p._id || 'free').toLowerCase();
        if (key in plans) {
            plans[key] = {
                total: p.total || 0,
                activeMau: p.activeMau || 0,
                activeDau: p.activeDau || 0
            };
        }
    });

    // Ratios & Percentages
    const dauToMauRatio = mau > 0 ? parseFloat(((dau / mau) * 100).toFixed(1)) : 0;
    const mauPercentage = totalUsers > 0 ? parseFloat(((mau / totalUsers) * 100).toFixed(1)) : 0;
    const dormantPercentage = totalUsers > 0 ? parseFloat(((dormant / totalUsers) * 100).toFixed(1)) : 0;

    return {
        timestamp: now.toISOString(),
        timeframe,
        metrics: {
            totalUsers,
            dau,
            wau,
            mau,
            dormant,
            newRegistrations: newInWindow,
            returningUsers: returningInWindow,
            neverActive,
            dauToMauRatio, // Stickiness ratio
            mauPercentage,
            dormantPercentage
        },
        plans,
        dailyActiveTrend,
        definitions: ACTIVITY_METRIC_DEFINITIONS
    };
}

/**
 * Lightweight summary for inclusion in general dashboard stats
 */
async function getUserActivitySummary() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    const thirtyDaysHex = Math.floor(thirtyDaysAgo.getTime() / 1000).toString(16).padEnd(24, '0');
    const thirtyDaysObjectId = new mongoose.Types.ObjectId(thirtyDaysHex);

    const sevenDaysHex = Math.floor(sevenDaysAgo.getTime() / 1000).toString(16).padEnd(24, '0');
    const sevenDaysObjectId = new mongoose.Types.ObjectId(sevenDaysHex);

    const aggResults = await userModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
            $facet: {
                dau: [
                    { $match: { lastActiveAt: { $gte: startOfToday } } },
                    { $count: 'count' }
                ],
                wau: [
                    { $match: { lastActiveAt: { $gte: sevenDaysAgo } } },
                    { $count: 'count' }
                ],
                mau: [
                    { $match: { lastActiveAt: { $gte: thirtyDaysAgo } } },
                    { $count: 'count' }
                ],
                dormant: [
                    {
                        $match: {
                            $or: [
                                { lastActiveAt: { $lt: thirtyDaysAgo } },
                                {
                                    lastActiveAt: null,
                                    $or: [
                                        { createdAt: { $lt: thirtyDaysAgo } },
                                        { createdAt: null, _id: { $lt: thirtyDaysObjectId } }
                                    ]
                                }
                            ]
                        }
                    },
                    { $count: 'count' }
                ],
                newLast7Days: [
                    {
                        $match: {
                            $or: [
                                { createdAt: { $gte: sevenDaysAgo } },
                                { createdAt: null, _id: { $gte: sevenDaysObjectId } }
                            ]
                        }
                    },
                    { $count: 'count' }
                ],
                returningLast7Days: [
                    {
                        $match: {
                            lastActiveAt: { $gte: sevenDaysAgo },
                            $or: [
                                { createdAt: { $lt: sevenDaysAgo } },
                                { createdAt: null, _id: { $lt: sevenDaysObjectId } }
                            ]
                        }
                    },
                    { $count: 'count' }
                ]
            }
        }
    ]);

    const facetResults = aggResults?.[0] || {};
    return {
        dau: facetResults.dau?.[0]?.count || 0,
        wau: facetResults.wau?.[0]?.count || 0,
        mau: facetResults.mau?.[0]?.count || 0,
        dormant: facetResults.dormant?.[0]?.count || 0,
        newLast7Days: facetResults.newLast7Days?.[0]?.count || 0,
        returningLast7Days: facetResults.returningLast7Days?.[0]?.count || 0
    };
}

/**
 * Utility to clear in-memory activity cache (useful for testing)
 */
function _clearActivityCacheForTesting() {
    localActivityCache.clear();
}

module.exports = {
    recordUserActivity,
    touchUserActivity,
    getUserActivityAnalytics,
    getUserActivitySummary,
    ACTIVITY_METRIC_DEFINITIONS,
    THROTTLE_WINDOW_SECONDS,
    THROTTLE_WINDOW_MS,
    _clearActivityCacheForTesting
};
