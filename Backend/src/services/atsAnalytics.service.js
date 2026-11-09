/**
 * atsAnalytics.service.js — Global ATS Score Aggregation & Intelligence Service
 *
 * Implements:
 * 1. High-performance MongoDB aggregation pipeline for global ATS telemetry.
 * 2. Missing, invalid and legacy score handling with clean normalization.
 * 3. 5-bucket score distribution (0-40, 41-60, 61-75, 76-85, 86-100).
 * 4. Temporal score trends over time (daily averages and evaluation volumes).
 * 5. Tier breakdown by candidate subscription plan (free, pro, premium).
 * 6. Redis / In-memory caching with 5-minute TTL to keep admin dashboard responsive.
 */

'use strict';

const mongoose = require('mongoose');
const interviewReportModel = require('../models/interviewReport.model');
const { getRedisClient } = require('../config/redis');

// In-Memory cache fallback for fast local development / Redis disconnection
const memoryCache = new Map();
const CACHE_TTL_SECONDS = 300; // 5 minutes

function getCached(key) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        memoryCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCached(key, data, ttlSeconds = CACHE_TTL_SECONDS) {
    memoryCache.set(key, {
        data,
        expiresAt: Date.now() + (ttlSeconds * 1000)
    });
}

/**
 * Calculates exact median value from an array of numbers
 */
function calculateMedian(numbers = []) {
    if (!numbers || numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
        return sorted[mid];
    }
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

/**
 * Computes global ATS telemetry using bounded aggregation pipelines
 */
async function getGlobalAtsAnalytics({ startDate, endDate, bypassCache = false } = {}) {
    const cacheKey = `analytics:ats:${startDate || 'all'}:${endDate || 'all'}`;

    // 1. Check in-memory / Redis cache
    if (!bypassCache) {
        const mem = getCached(cacheKey);
        if (mem) return { ...mem, fromCache: true };

        try {
            const client = getRedisClient();
            if (client && (client.status === 'ready' || client.status === 'connect')) {
                const cachedStr = await client.get(cacheKey);
                if (cachedStr) {
                    const parsed = JSON.parse(cachedStr);
                    setCached(cacheKey, parsed, CACHE_TTL_SECONDS);
                    return { ...parsed, fromCache: true };
                }
            }
        } catch (_) {}
    }

    // 2. Build date & validity filter
    const matchFilter = {
        $or: [
            { matchScore: { $gte: 0, $lte: 100 } },
            { 'atsScoreBreakdown.overallScore': { $gte: 0, $lte: 100 } }
        ]
    };

    if (startDate || endDate) {
        matchFilter.createdAt = {};
        if (startDate && !isNaN(new Date(startDate).getTime())) {
            matchFilter.createdAt.$gte = new Date(startDate);
        }
        if (endDate && !isNaN(new Date(endDate).getTime())) {
            const e = new Date(endDate);
            e.setHours(23, 59, 59, 999);
            matchFilter.createdAt.$lte = e;
        }
    }

    // 3. Multi-stage Aggregation Pipeline
    const pipeline = [
        { $match: matchFilter },
        // Normalize score to a single cleanScore field (handling legacy or breakdown fallback)
        {
            $addFields: {
                cleanScore: {
                    $round: [
                        {
                            $ifNull: [
                                "$matchScore",
                                { $ifNull: ["$atsScoreBreakdown.overallScore", 0] }
                            ]
                        },
                        1
                    ]
                }
            }
        },
        // Ensure cleanScore is strictly numeric and within [0, 100]
        {
            $match: {
                cleanScore: { $gte: 0, $lte: 100 }
            }
        },
        // Run parallel facets for Summary, Distribution, Trends, and Plan Breakdown
        {
            $facet: {
                // Summary Metrics
                summary: [
                    {
                        $group: {
                            _id: null,
                            totalEvaluations: { $sum: 1 },
                            avgScore: { $avg: "$cleanScore" },
                            minScore: { $min: "$cleanScore" },
                            maxScore: { $max: "$cleanScore" },
                            allScores: { $push: "$cleanScore" }
                        }
                    }
                ],

                // Score Range Distribution
                distribution: [
                    {
                        $bucket: {
                            groupBy: "$cleanScore",
                            boundaries: [0, 41, 61, 76, 86, 101],
                            default: "other",
                            output: {
                                count: { $sum: 1 }
                            }
                        }
                    }
                ],

                // Temporal Trends (Last 30 active days)
                trends: [
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            avgScore: { $avg: "$cleanScore" },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { "_id": 1 } },
                    { $limit: 30 }
                ],

                // Breakdown by User Subscription Plan
                byPlan: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "user",
                            foreignField: "_id",
                            as: "userData"
                        }
                    },
                    {
                        $unwind: {
                            path: "$userData",
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $group: {
                            _id: { $ifNull: ["$userData.plan", "free"] },
                            avgScore: { $avg: "$cleanScore" },
                            total: { $sum: 1 }
                        }
                    }
                ]
            }
        }
    ];

    const [results] = await interviewReportModel.aggregate(pipeline);

    // Format Summary
    const rawSummary = results?.summary?.[0] || {
        totalEvaluations: 0,
        avgScore: 0,
        minScore: 0,
        maxScore: 0,
        allScores: []
    };

    const medianScore = calculateMedian(rawSummary.allScores || []);

    const summary = {
        totalEvaluations: rawSummary.totalEvaluations || 0,
        avgScore: rawSummary.totalEvaluations > 0 ? Math.round((rawSummary.avgScore || 0) * 10) / 10 : 0,
        medianScore,
        highestScore: rawSummary.totalEvaluations > 0 ? rawSummary.maxScore : 0,
        lowestScore: rawSummary.totalEvaluations > 0 ? rawSummary.minScore : 0
    };

    // Format 5-Bucket Distribution
    const bucketLabels = {
        0: { label: '0 - 40', title: 'Critical Gap', color: '#f87171' },
        41: { label: '41 - 60', title: 'Needs Work', color: '#fbbf24' },
        61: { label: '61 - 75', title: 'Competitive', color: '#38bdf8' },
        76: { label: '76 - 85', title: 'Strong Match', color: '#818cf8' },
        86: { label: '86 - 100', title: 'ATS Ready', color: '#34d399' }
    };

    const distributionMap = {};
    Object.keys(bucketLabels).forEach(k => {
        distributionMap[k] = 0;
    });

    (results?.distribution || []).forEach(b => {
        if (distributionMap[b._id] !== undefined) {
            distributionMap[b._id] = b.count;
        }
    });

    const totalEvals = summary.totalEvaluations || 1;
    const distribution = Object.entries(bucketLabels).map(([boundary, meta]) => {
        const count = distributionMap[boundary] || 0;
        const percentage = Math.round((count / totalEvals) * 1000) / 10;
        return {
            range: meta.label,
            label: meta.title,
            count,
            percentage,
            color: meta.color
        };
    });

    // Format Trends
    const trends = (results?.trends || []).map(t => ({
        date: t._id,
        avgScore: Math.round((t.avgScore || 0) * 10) / 10,
        count: t.count
    }));

    // Format Plan Breakdown
    const planBreakdown = {
        free: { count: 0, avgScore: 0 },
        pro: { count: 0, avgScore: 0 },
        premium: { count: 0, avgScore: 0 }
    };

    (results?.byPlan || []).forEach(p => {
        const planKey = String(p._id).toLowerCase();
        if (planBreakdown[planKey]) {
            planBreakdown[planKey] = {
                count: p.total,
                avgScore: Math.round((p.avgScore || 0) * 10) / 10
            };
        }
    });

    const responseData = {
        summary,
        distribution,
        trends,
        planBreakdown,
        updatedAt: new Date().toISOString()
    };

    // Save to Cache
    setCached(cacheKey, responseData, CACHE_TTL_SECONDS);
    try {
        const client = getRedisClient();
        if (client && (client.status === 'ready' || client.status === 'connect')) {
            await client.set(cacheKey, JSON.stringify(responseData), 'EX', CACHE_TTL_SECONDS);
        }
    } catch (_) {}

    return responseData;
}

module.exports = {
    getGlobalAtsAnalytics,
    calculateMedian
};

