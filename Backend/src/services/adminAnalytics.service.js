/**
 * adminAnalytics.service.js — High-Performance Admin Analytics Aggregation Engine
 *
 * Requirements:
 * 1. Single-pass or optimized index-backed MongoDB aggregation pipelines.
 * 2. Strict previous-period comparison with mathematically valid percentage changes.
 * 3. Never display fabricated or synthetic metrics.
 * 4. Separate user plan assignment from subscription records (account for orphaned/missing subscriptions).
 * 5. Accurate revenue aggregation from verified successful payments without double-counting.
 * 6. Multi-series application traffic aggregation across jobs, reports, cover letters, and AI invocations.
 * 7. Server-side caching where appropriate with safe invalidation.
 */

'use strict';

const mongoose = require('mongoose');
const userModel = require('../models/user.model');
const subscriptionModel = require('../models/subscription.model');
const paymentModel = require('../models/payment.model');
const interviewReportModel = require('../models/interviewReport.model');
const coverLetterModel = require('../models/coverLetter.model');
const jobModel = require('../models/job.model');
const aiUsageModel = require('../models/aiUsage.model');
const { SystemEvent } = require('../models/systemEvent.model');
const redisConfig = require('../config/redis');

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
 * Parse timeframes into explicit [startDate, endDate, prevStartDate, prevEndDate]
 */
function parseTimeframeWindow(timeframe = '30d', customStart = null, customEnd = null) {
    const now = new Date();
    let endDate = now;
    let startDate;

    if (customStart && customEnd) {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            endDate = now;
        }
    } else {
        switch (timeframe) {
            case '24h':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
            default:
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
        }
    }

    const durationMs = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime());
    const prevStartDate = new Date(startDate.getTime() - durationMs);

    return { startDate, endDate, prevStartDate, prevEndDate, durationMs };
}

/**
 * Calculate mathematically sound percentage change
 */
function calculatePctChange(current, previous) {
    if (typeof previous !== 'number' || typeof current !== 'number') return null;
    if (previous === 0) {
        if (current === 0) return 0;
        return 100; // From 0 to positive
    }
    const pct = ((current - previous) / previous) * 100;
    return parseFloat(pct.toFixed(1));
}

/**
 * Generate dates array for continuous time-series charts
 */
function generateContinuousDateBuckets(startDate, endDate, isHourly = false) {
    const buckets = [];
    const current = new Date(startDate);

    if (isHourly) {
        current.setMinutes(0, 0, 0);
        while (current <= endDate) {
            buckets.push(current.toISOString().slice(0, 13) + ':00');
            current.setHours(current.getHours() + 1);
        }
    } else {
        current.setHours(0, 0, 0, 0);
        while (current <= endDate) {
            buckets.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
    }
    return buckets;
}

/**
 * 1. Overview KPIs & Summary
 */
async function getOverviewAnalytics({ timeframe = '30d', startDate: qStart, endDate: qEnd } = {}) {
    const { startDate, endDate, prevStartDate, prevEndDate } = parseTimeframeWindow(timeframe, qStart, qEnd);

    // Cache key for overview
    const redis = getClientSafely();
    const cacheKey = `admin:analytics:overview:${timeframe}:${startDate.toISOString()}:${endDate.toISOString()}`;
    if (redis) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (_) {}
    }

    // Run parallel aggregation queries with individual defensive fault tolerance
    const [
        totalUsersCurrent = 0,
        totalUsersPrev = 0,
        activeUsersCurrent = 0,
        activeUsersPrev = 0,
        newUsersCurrent = 0,
        newUsersPrev = 0,
        activeSubscriptionsCurrent = 0,
        activeSubscriptionsPrev = 0,
        paidSubscribersCurrent = 0,
        paidSubscribersPrev = 0,
        paymentsCurrentAgg = [],
        paymentsPrevAgg = [],
        failedPaymentsCurrent = 0,
        failedPaymentsPrev = 0,
        activityCurrentAgg = 0,
        activityPrevAgg = 0,
        userPlanDistributionAgg = [],
        subscriptionStatusAgg = [],
        recentRegistrations = [],
        recentPayments = [],
        recentAuditActivities = []
    ] = await Promise.all([
        // 1. Total Registered Users
        userModel.countDocuments({ isDeleted: { $ne: true } }).catch(() => 0),
        userModel.countDocuments({
            isDeleted: { $ne: true },
            $or: [{ createdAt: { $lt: startDate } }, { createdAt: null }]
        }).catch(() => 0),

        // 2. Active Users in window (check lastActiveAt or fallback to updatedAt if lastActiveAt unset)
        userModel.countDocuments({
            isDeleted: { $ne: true },
            $or: [
                { lastActiveAt: { $gte: startDate, $lte: endDate } },
                { lastActiveAt: null, updatedAt: { $gte: startDate, $lte: endDate } }
            ]
        }).catch(() => 0),
        userModel.countDocuments({
            isDeleted: { $ne: true },
            $or: [
                { lastActiveAt: { $gte: prevStartDate, $lt: startDate } },
                { lastActiveAt: null, updatedAt: { $gte: prevStartDate, $lt: startDate } }
            ]
        }).catch(() => 0),

        // 3. New Registrations in window
        userModel.countDocuments({
            isDeleted: { $ne: true },
            createdAt: { $gte: startDate, $lte: endDate }
        }).catch(() => 0),
        userModel.countDocuments({
            isDeleted: { $ne: true },
            createdAt: { $gte: prevStartDate, $lt: startDate }
        }).catch(() => 0),

        // 4. Active Subscriptions (case-insensitive for both 'ACTIVE' and 'active')
        subscriptionModel.countDocuments({ status: { $in: ['ACTIVE', 'active'] } }).catch(() => 0),
        subscriptionModel.countDocuments({ status: { $in: ['ACTIVE', 'active'] }, createdAt: { $lt: startDate } }).catch(() => 0),

        // 5. Unique Paid Subscribers (Users with plan Pro or Premium)
        userModel.countDocuments({ isDeleted: { $ne: true }, plan: { $in: ['pro', 'premium', 'PRO', 'PREMIUM'] } }).catch(() => 0),
        userModel.countDocuments({
            isDeleted: { $ne: true },
            plan: { $in: ['pro', 'premium', 'PRO', 'PREMIUM'] },
            $or: [{ createdAt: { $lt: startDate } }, { createdAt: null }]
        }).catch(() => 0),

        // 6. Total Successful Payments / Revenue (INR paise -> rupees)
        paymentModel.aggregate([
            { $match: { status: 'SUCCESS', createdAt: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: null, totalAmountPaise: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]).catch(() => []),
        paymentModel.aggregate([
            { $match: { status: 'SUCCESS', createdAt: { $gte: prevStartDate, $lt: startDate } } },
            { $group: { _id: null, totalAmountPaise: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]).catch(() => []),

        // 7. Failed Payments
        paymentModel.countDocuments({ status: 'FAILED', createdAt: { $gte: startDate, $lte: endDate } }).catch(() => 0),
        paymentModel.countDocuments({ status: 'FAILED', createdAt: { $gte: prevStartDate, $lt: startDate } }).catch(() => 0),

        // 8. Application Activity (Operational events across jobs, reports, cover letters, AI usage)
        Promise.all([
            jobModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }).catch(() => 0),
            interviewReportModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }).catch(() => 0),
            coverLetterModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }).catch(() => 0),
            aiUsageModel.countDocuments({ timestamp: { $gte: startDate, $lte: endDate } }).catch(() => 0)
        ]).then(([j, r, c, a]) => j + r + c + a).catch(() => 0),
        Promise.all([
            jobModel.countDocuments({ createdAt: { $gte: prevStartDate, $lt: startDate } }).catch(() => 0),
            interviewReportModel.countDocuments({ createdAt: { $gte: prevStartDate, $lt: startDate } }).catch(() => 0),
            coverLetterModel.countDocuments({ createdAt: { $gte: prevStartDate, $lt: startDate } }).catch(() => 0),
            aiUsageModel.countDocuments({ timestamp: { $gte: prevStartDate, $lt: startDate } }).catch(() => 0)
        ]).then(([j, r, c, a]) => j + r + c + a).catch(() => 0),

        // User Plan Distribution
        userModel.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            { $group: { _id: { $ifNull: ['$plan', 'free'] }, count: { $sum: 1 } } }
        ]).catch(() => []),

        // Subscription Status Breakdown (normalize case)
        subscriptionModel.aggregate([
            { $group: { _id: { $toUpper: '$status' }, count: { $sum: 1 } } }
        ]).catch(() => []),

        // Recent Registrations (latest 5 users)
        userModel.find({ isDeleted: { $ne: true } })
            .select('username email plan role isBlocked lastActiveAt createdAt')
            .sort({ createdAt: -1, _id: -1 })
            .limit(5)
            .lean()
            .catch(() => []),

        // Recent Successful Payments (latest 5 payments)
        paymentModel.find({ status: 'SUCCESS' })
            .populate('userId', 'username email plan')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean()
            .catch(() => []),

        // Recent Admin Audit Activities (latest 5 audit logs from SystemEvent)
        SystemEvent.find({ category: 'ADMIN' })
            .select('eventType actorRole changeSummary metadata createdAt severity details')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean()
            .catch(() => [])
    ]);

    // Format revenue
    const revCurrentPaise = paymentsCurrentAgg?.[0]?.totalAmountPaise || 0;
    const revCurrentCount = paymentsCurrentAgg?.[0]?.count || 0;
    const revPrevPaise = paymentsPrevAgg?.[0]?.totalAmountPaise || 0;
    const revPrevCount = paymentsPrevAgg?.[0]?.count || 0;

    const revCurrentRupees = parseFloat((revCurrentPaise / 100).toFixed(2));
    const revPrevRupees = parseFloat((revPrevPaise / 100).toFixed(2));

    // Format plans
    const userPlans = { free: 0, pro: 0, premium: 0 };
    (userPlanDistributionAgg || []).forEach(p => {
        const k = (p?._id || 'free').toLowerCase();
        if (k in userPlans) userPlans[k] = p.count;
    });

    // Format subscription statuses
    const subscriptionStatuses = {
        ACTIVE: 0,
        CANCELLED: 0,
        EXPIRED: 0,
        GRACE_PERIOD: 0,
        PAST_DUE: 0
    };
    (subscriptionStatusAgg || []).forEach(s => {
        const k = (s?._id || '').toUpperCase();
        if (k in subscriptionStatuses) subscriptionStatuses[k] = s.count;
    });

    const totalSubDocs = Object.values(subscriptionStatuses).reduce((a, b) => a + b, 0);

    const kpis = {
        totalUsers: {
            title: 'Total Registered Users',
            value: totalUsersCurrent,
            previous: totalUsersPrev,
            change: calculatePctChange(totalUsersCurrent, totalUsersPrev),
            description: 'All non-deleted user accounts on platform'
        },
        activeUsers: {
            title: 'Active Users',
            value: activeUsersCurrent,
            previous: activeUsersPrev,
            change: calculatePctChange(activeUsersCurrent, activeUsersPrev),
            description: 'Users active within selected timeframe'
        },
        newRegistrations: {
            title: 'New Registrations',
            value: newUsersCurrent,
            previous: newUsersPrev,
            change: calculatePctChange(newUsersCurrent, newUsersPrev),
            description: 'New user signups during selected timeframe'
        },
        activeSubscriptions: {
            title: 'Active Subscriptions',
            value: activeSubscriptionsCurrent,
            previous: activeSubscriptionsPrev,
            change: calculatePctChange(activeSubscriptionsCurrent, activeSubscriptionsPrev),
            description: 'Currently active paid subscription records'
        },
        paidSubscribers: {
            title: 'Paid Subscribers',
            value: paidSubscribersCurrent,
            previous: paidSubscribersPrev,
            change: calculatePctChange(paidSubscribersCurrent, paidSubscribersPrev),
            description: 'Unique registered users on Pro or Premium plans'
        },
        totalRevenue: {
            title: 'Total Revenue',
            value: revCurrentRupees,
            valueFormatted: `₹${revCurrentRupees.toLocaleString('en-IN')}`,
            previous: revPrevRupees,
            change: calculatePctChange(revCurrentRupees, revPrevRupees),
            count: revCurrentCount,
            currency: 'INR',
            description: 'Verified settled revenue from successful payments'
        },
        failedPayments: {
            title: 'Failed Payments',
            value: failedPaymentsCurrent,
            previous: failedPaymentsPrev,
            change: calculatePctChange(failedPaymentsCurrent, failedPaymentsPrev),
            description: 'Gateway payment attempts marked as failed'
        },
        appActivity: {
            title: 'Application Activity',
            value: activityCurrentAgg,
            previous: activityPrevAgg,
            change: calculatePctChange(activityCurrentAgg, activityPrevAgg),
            description: 'Total generation, scoring, and AI operations executed'
        }
    };

    const result = {
        timeframe,
        window: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            prevStartDate: prevStartDate.toISOString(),
            prevEndDate: prevEndDate.toISOString()
        },
        kpis,
        plans: {
            userPlanDistribution: userPlans,
            totalUsersWithPlans: totalUsersCurrent,
            subscriptionStatusDistribution: subscriptionStatuses,
            totalSubscriptionDocs: totalSubDocs,
            note: `Platform has ${totalUsersCurrent} registered users and ${totalSubDocs} subscription records. Users without active billing remain on Free plan.`
        },
        recent: {
            registrations: Array.isArray(recentRegistrations) ? recentRegistrations : [],
            payments: (Array.isArray(recentPayments) ? recentPayments : []).map(p => ({
                id: p?._id,
                amountRupees: ((Number(p?.amount) || 0) / 100).toFixed(2),
                currency: p?.currency || 'INR',
                method: p?.paymentMethod || 'UPI/Card',
                user: p?.userId ? { username: p.userId.username, email: p.userId.email, plan: p.userId.plan } : null,
                createdAt: p?.createdAt
            })),
            auditActivities: Array.isArray(recentAuditActivities) ? recentAuditActivities : []
        }
    };

    // Cache for 60 seconds
    if (redis) {
        try {
            await redis.setex(cacheKey, 60, JSON.stringify(result));
        } catch (_) {}
    }

    return result;
}

/**
 * 2. Application Traffic and Activity — Interactive Area Chart
 */
async function getTrafficAnalytics({ timeframe = '30d', startDate: qStart, endDate: qEnd } = {}) {
    const { startDate, endDate } = parseTimeframeWindow(timeframe, qStart, qEnd);
    const isHourly = timeframe === '24h';
    const dateBuckets = generateContinuousDateBuckets(startDate, endDate, isHourly);
    const formatString = isHourly ? '%Y-%m-%d %H:00' : '%Y-%m-%d';

    const [jobsAgg, reportsAgg, coverLettersAgg, aiUsageAgg] = await Promise.all([
        // Jobs (Resume HTML & Rewrites)
        jobModel.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: formatString, date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            }
        ]),

        // Mock Interview Reports & ATS Evaluations
        interviewReportModel.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: formatString, date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            }
        ]),

        // Cover Letters
        coverLetterModel.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: formatString, date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            }
        ]),

        // AI Assistant Invocations
        aiUsageModel.aggregate([
            { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: formatString, date: '$timestamp' } },
                    count: { $sum: 1 }
                }
            }
        ])
    ]);

    const jobsMap = new Map(jobsAgg.map(r => [r._id, r.count]));
    const reportsMap = new Map(reportsAgg.map(r => [r._id, r.count]));
    const coverLettersMap = new Map(coverLettersAgg.map(r => [r._id, r.count]));
    const aiUsageMap = new Map(aiUsageAgg.map(r => [r._id, r.count]));

    const series = dateBuckets.map(bucket => {
        const resumes = jobsMap.get(bucket) || 0;
        const interviews = reportsMap.get(bucket) || 0;
        const coverLetters = coverLettersMap.get(bucket) || 0;
        const aiAssistant = aiUsageMap.get(bucket) || 0;
        const total = resumes + interviews + coverLetters + aiAssistant;

        return {
            timestamp: bucket,
            resumes,
            interviews,
            coverLetters,
            aiAssistant,
            total
        };
    });

    return {
        timeframe,
        isHourly,
        totalEvents: series.reduce((acc, s) => acc + s.total, 0),
        series
    };
}

/**
 * 3. New Users and Registrations — Line Chart
 */
async function getRegistrationAnalytics({ timeframe = '30d', startDate: qStart, endDate: qEnd } = {}) {
    const { startDate, endDate, prevStartDate, prevEndDate } = parseTimeframeWindow(timeframe, qStart, qEnd);
    const dateBuckets = generateContinuousDateBuckets(startDate, endDate, false);

    // Current period registrations grouped by date and provider/type
    const [currentAgg, prevAgg] = await Promise.all([
        userModel.aggregate([
            {
                $addFields: {
                    userCreatedAt: { $ifNull: ['$createdAt', { $toDate: '$_id' }] }
                }
            },
            {
                $match: {
                    isDeleted: { $ne: true },
                    userCreatedAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$userCreatedAt' } },
                    total: { $sum: 1 }
                }
            }
        ]),
        userModel.aggregate([
            {
                $addFields: {
                    userCreatedAt: { $ifNull: ['$createdAt', { $toDate: '$_id' }] }
                }
            },
            {
                $match: {
                    isDeleted: { $ne: true },
                    userCreatedAt: { $gte: prevStartDate, $lt: startDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$userCreatedAt' } },
                    total: { $sum: 1 }
                }
            }
        ])
    ]);

    const currentMap = new Map(currentAgg.map(r => [r._id, r.total]));
    const prevMap = new Map(prevAgg.map(r => [r._id, r.total]));

    const timeline = dateBuckets.map((bucket, index) => {
        const count = currentMap.get(bucket) || 0;
        return {
            date: bucket,
            count,
            previousCount: Array.from(prevMap.values())[index] || 0
        };
    });

    const totalNewInPeriod = timeline.reduce((sum, d) => sum + d.count, 0);
    const totalNewInPrev = Array.from(prevMap.values()).reduce((sum, c) => sum + c, 0);

    return {
        timeframe,
        totalNewInPeriod,
        totalNewInPrev,
        pctChange: calculatePctChange(totalNewInPeriod, totalNewInPrev),
        timeline
    };
}

/**
 * 4. Revenue and Payments — Bar/Line Chart
 */
async function getRevenueAnalytics({ timeframe = '30d', startDate: qStart, endDate: qEnd } = {}) {
    const { startDate, endDate } = parseTimeframeWindow(timeframe, qStart, qEnd);
    const dateBuckets = generateContinuousDateBuckets(startDate, endDate, false);

    const paymentsAgg = await paymentModel.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    status: '$status'
                },
                totalAmountPaise: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    const dataMap = new Map();
    paymentsAgg.forEach(p => {
        const key = p._id.date;
        if (!dataMap.has(key)) {
            dataMap.set(key, { successfulAmountRupees: 0, successfulCount: 0, failedCount: 0 });
        }
        const record = dataMap.get(key);
        if (p._id.status === 'SUCCESS') {
            record.successfulAmountRupees += p.totalAmountPaise / 100;
            record.successfulCount += p.count;
        } else if (p._id.status === 'FAILED') {
            record.failedCount += p.count;
        }
    });

    const timeline = dateBuckets.map(date => {
        const d = dataMap.get(date) || { successfulAmountRupees: 0, successfulCount: 0, failedCount: 0 };
        return {
            date,
            revenue: parseFloat(d.successfulAmountRupees.toFixed(2)),
            successfulCount: d.successfulCount,
            failedCount: d.failedCount
        };
    });

    const totalRevenue = timeline.reduce((acc, t) => acc + t.revenue, 0);
    const totalSuccessful = timeline.reduce((acc, t) => acc + t.successfulCount, 0);
    const totalFailed = timeline.reduce((acc, t) => acc + t.failedCount, 0);

    return {
        timeframe,
        currency: 'INR',
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalSuccessful,
        totalFailed,
        timeline
    };
}

/**
 * 5. Plan Distribution Analytics (Radar Chart Data)
 */
async function getPlanAnalytics() {
    const [userPlansAgg, subPlansAgg] = await Promise.all([
        userModel.aggregate([
            { $match: { isDeleted: { $ne: true } } },
            { $group: { _id: { $ifNull: ['$plan', 'free'] }, count: { $sum: 1 } } }
        ]),
        subscriptionModel.aggregate([
            { $match: { status: { $in: ['ACTIVE', 'active'] } } },
            { $group: { _id: { $toLower: { $ifNull: ['$plan', 'free'] } }, count: { $sum: 1 } } }
        ])
    ]);

    const userPlans = { free: 0, pro: 0, premium: 0 };
    userPlansAgg.forEach(p => {
        const k = (p._id || 'free').toLowerCase();
        if (k in userPlans) userPlans[k] = p.count;
    });

    const subPlans = { free: 0, pro: 0, premium: 0 };
    subPlansAgg.forEach(s => {
        const k = (s._id || 'free').toLowerCase();
        if (k in subPlans) subPlans[k] = s.count;
    });

    const totalUserPlans = userPlans.free + userPlans.pro + userPlans.premium || 1;

    const radarData = [
        {
            tier: 'FREE',
            users: userPlans.free,
            subscriptions: subPlans.free,
            percentage: parseFloat(((userPlans.free / totalUserPlans) * 100).toFixed(1)),
            maxQuota: Math.max(userPlans.free, 100)
        },
        {
            tier: 'PRO',
            users: userPlans.pro,
            subscriptions: subPlans.pro,
            percentage: parseFloat(((userPlans.pro / totalUserPlans) * 100).toFixed(1)),
            maxQuota: Math.max(userPlans.pro, 100)
        },
        {
            tier: 'PREMIUM',
            users: userPlans.premium,
            subscriptions: subPlans.premium,
            percentage: parseFloat(((userPlans.premium / totalUserPlans) * 100).toFixed(1)),
            maxQuota: Math.max(userPlans.premium, 100)
        }
    ];

    return {
        radarData,
        userPlans,
        subscriptionPlans: subPlans,
        totalUsers: totalUserPlans,
        note: 'User tier distribution tracks account plan privileges. Subscription records track active payment agreements.'
    };
}

/**
 * 6. Feature Usage — Horizontal Bar Chart
 */
async function getFeatureUsageAnalytics({ timeframe = '30d' } = {}) {
    const { startDate, endDate } = parseTimeframeWindow(timeframe);

    const [resumesCount, interviewsCount, coverLettersCount, aiInvocationsCount] = await Promise.all([
        jobModel.countDocuments({ type: 'resume_html', createdAt: { $gte: startDate, $lte: endDate } }),
        interviewReportModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
        coverLetterModel.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } }),
        aiUsageModel.countDocuments({
            feature: { $in: ['ai_assistant', 'section_writer', 'resume_rewrite'] },
            timestamp: { $gte: startDate, $lte: endDate }
        })
    ]);

    const features = [
        { name: 'Mock Interview Reports', count: interviewsCount, category: 'Evaluation', icon: 'FileText' },
        { name: 'Resume Generation & PDF', count: resumesCount, category: 'Documents', icon: 'FileCode' },
        { name: 'AI Cover Letters', count: coverLettersCount, category: 'Documents', icon: 'FileCheck' },
        { name: 'AI Assistant & Rewrite', count: aiInvocationsCount, category: 'AI Tools', icon: 'Sparkles' }
    ];

    // Sort descending by usage
    features.sort((a, b) => b.count - a.count);

    const totalUsage = features.reduce((sum, f) => sum + f.count, 0);

    return {
        timeframe,
        totalUsage,
        features: features.map(f => ({
            ...f,
            percentage: totalUsage > 0 ? parseFloat(((f.count / totalUsage) * 100).toFixed(1)) : 0
        }))
    };
}

/**
 * 7. User Engagement Activity Heatmap
 */
async function getActivityHeatmapAnalytics({ days = 60 } = {}) {
    const daysCount = Math.min(180, Math.max(14, parseInt(days) || 60));
    const now = new Date();
    const startDate = new Date(now.getTime() - (daysCount * 24 * 60 * 60 * 1000));
    startDate.setHours(0, 0, 0, 0);

    const dailyActiveAgg = await userModel.aggregate([
        {
            $match: {
                isDeleted: { $ne: true },
                lastActiveAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastActiveAt' } },
                activeUsers: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const activeMap = new Map(dailyActiveAgg.map(r => [r._id, r.activeUsers]));
    const maxActive = Math.max(...Array.from(activeMap.values()), 1);

    const heatmap = [];
    for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const count = activeMap.get(dateStr) || 0;

        // Level 0 to 4 based on quartiles
        let level = 0;
        if (count > 0) {
            const ratio = count / maxActive;
            if (ratio > 0.75) level = 4;
            else if (ratio > 0.5) level = 3;
            else if (ratio > 0.25) level = 2;
            else level = 1;
        }

        heatmap.push({
            date: dateStr,
            count,
            level
        });
    }

    return {
        days: daysCount,
        maxDailyActive: maxActive,
        totalActiveEvents: heatmap.reduce((acc, h) => acc + h.count, 0),
        heatmap
    };
}

/**
 * 8. Recent Users Paginated Data Table
 */
async function getRecentUsersTable({
    page = 1,
    limit = 10,
    search = '',
    plan = '',
    status = '',
    sortBy = 'createdAt',
    sortOrder = 'desc'
} = {}) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));

    const filter = { isDeleted: { $ne: true } };

    if (search && search.trim()) {
        const term = search.trim();
        filter.$or = [
            { username: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } }
        ];
    }

    if (plan && plan !== 'all') {
        filter.plan = plan.toLowerCase();
    }

    if (status) {
        if (status === 'blocked') filter.isBlocked = true;
        if (status === 'active') filter.isBlocked = false;
    }

    const sortOptions = {};
    const validSortFields = ['createdAt', 'lastActiveAt', 'username', 'email', 'plan'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    sortOptions[field] = sortOrder === 'asc' ? 1 : -1;

    const [users, totalCount] = await Promise.all([
        userModel.find(filter)
            .select('username email role plan isBlocked lastActiveAt createdAt customBonusCredits')
            .sort(sortOptions)
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
        userModel.countDocuments(filter)
    ]);

    // Enhance users with activity label
    const enhancedUsers = users.map(u => {
        let activityStatus = 'inactive';
        if (u.lastActiveAt) {
            const diffMs = Date.now() - new Date(u.lastActiveAt).getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            if (diffHours < 1) activityStatus = 'online';
            else if (diffHours < 24) activityStatus = 'recent';
            else activityStatus = 'idle';
        }

        return {
            _id: u._id,
            username: u.username,
            email: u.email,
            role: u.role,
            plan: u.plan || 'free',
            isBlocked: Boolean(u.isBlocked),
            lastActiveAt: u.lastActiveAt,
            activityStatus,
            createdAt: u.createdAt || new Date(parseInt(u._id.toString().substring(0, 8), 16) * 1000),
            customBonusCredits: u.customBonusCredits || 0
        };
    });

    return {
        users: enhancedUsers,
        pagination: {
            total: totalCount,
            page: pageNum,
            pages: Math.ceil(totalCount / limitNum) || 1,
            limit: limitNum
        }
    };
}

module.exports = {
    getOverviewAnalytics,
    getTrafficAnalytics,
    getRegistrationAnalytics,
    getRevenueAnalytics,
    getPlanAnalytics,
    getFeatureUsageAnalytics,
    getActivityHeatmapAnalytics,
    getRecentUsersTable
};
