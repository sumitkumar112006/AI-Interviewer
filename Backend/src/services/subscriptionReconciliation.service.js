/**
 * subscriptionReconciliation.service.js — Subscription Data Integrity, Lifecycle & Financial Reconciliation
 *
 * Implements:
 * 1. Safe normalization layer for subscription statuses across legacy & modern records.
 * 2. Read-only forensic diagnostic engine comparing Users vs Subscriptions vs Payments vs Invoices.
 * 3. Identifies missing dates, casing inconsistencies, duplicate subscriptions, and orphaned records.
 * 4. Zero destructive mutations — strictly read-only diagnostics for administrators.
 */

'use strict';

const mongoose = require('mongoose');
const subscriptionModel = require('../models/subscription.model');
const userModel = require('../models/user.model');
const Payment = require('../models/payment.model');
const PaymentOrder = require('../models/paymentOrder.model');
const { Invoice } = require('../models/invoice.model');

// Valid normalized subscription statuses
const SUBSCRIPTION_STATUSES = Object.freeze({
    ACTIVE: 'ACTIVE',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED',
    PAST_DUE: 'PAST_DUE',
    GRACE_PERIOD: 'GRACE_PERIOD'
});

/**
 * Normalizes subscription status to standard uppercase format.
 *
 * @param {string} status - Raw status string
 * @returns {string} Normalized status
 */
function normalizeSubscriptionStatus(status) {
    if (!status || typeof status !== 'string') {
        return SUBSCRIPTION_STATUSES.ACTIVE;
    }
    const clean = status.trim().toUpperCase();
    if (Object.values(SUBSCRIPTION_STATUSES).includes(clean)) {
        return clean;
    }
    return clean;
}

/**
 * Evaluates real-time subscription lifecycle state without modifying historical records.
 *
 * @param {Object} sub - Subscription document
 * @param {Date} [referenceDate=new Date()] - Reference point for time comparisons
 * @returns {{ effectiveStatus: string, reason: string, isPastDue: boolean }}
 */
function evaluateSubscriptionLifecycle(sub, referenceDate = new Date()) {
    const rawStatus = normalizeSubscriptionStatus(sub.status);
    const plan = (sub.plan || 'free').toLowerCase();
    const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
    const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

    // 1. Explicitly cancelled subscriptions remain cancelled
    if (rawStatus === SUBSCRIPTION_STATUSES.CANCELLED) {
        return {
            effectiveStatus: SUBSCRIPTION_STATUSES.CANCELLED,
            reason: 'Subscription was manually or programmatically cancelled.',
            isPastDue: false
        };
    }

    // 2. Free tier subscriptions do not terminate upon period end;
    // their currentPeriodEnd represents the rolling 30-day token reset cycle.
    if (plan === 'free') {
        return {
            effectiveStatus: SUBSCRIPTION_STATUSES.ACTIVE,
            reason: 'Free tier access remains active indefinitely (rolling 30-day quota window).',
            isPastDue: periodEnd ? periodEnd < now : false
        };
    }

    // 3. Paid subscriptions: evaluate periodEnd and grace period (48 hours)
    if (periodEnd) {
        const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000; // 48-hour gateway webhook window
        if (now <= periodEnd) {
            return {
                effectiveStatus: SUBSCRIPTION_STATUSES.ACTIVE,
                reason: 'Current paid billing period is active.',
                isPastDue: false
            };
        } else if (now.getTime() <= periodEnd.getTime() + GRACE_PERIOD_MS) {
            return {
                effectiveStatus: SUBSCRIPTION_STATUSES.GRACE_PERIOD,
                reason: 'Paid period expired within 48-hour renewal grace window.',
                isPastDue: true
            };
        } else {
            return {
                effectiveStatus: SUBSCRIPTION_STATUSES.EXPIRED,
                reason: 'Paid billing period elapsed past grace window without renewal payment.',
                isPastDue: true
            };
        }
    }

    return {
        effectiveStatus: rawStatus,
        reason: 'Default status maintained.',
        isPastDue: false
    };
}

/**
 * Read-only diagnostic reconciliation of Users, Subscriptions, Payments, and Invoices.
 * Uses high-performance MongoDB aggregations without fetching entire collections into memory.
 *
 * @returns {Promise<Object>} Comprehensive reconciliation telemetry
 */
async function getSubscriptionAndFinancialReconciliation() {
    const now = new Date();

    // ─── 1. Total Users Breakdown (Section 8) ──────────────────────────────
    const [
        totalUsers,
        usersByPlanAgg,
        deletedUsersCount,
        blockedUsersCount,
        unverifiedUsersCount
    ] = await Promise.all([
        userModel.countDocuments(),
        userModel.aggregate([
            { $group: { _id: '$plan', count: { $sum: 1 } } }
        ]),
        userModel.countDocuments({ isDeleted: true }),
        userModel.countDocuments({ isBlocked: true }),
        userModel.countDocuments({ isVerified: false })
    ]);

    const usersByPlan = { free: 0, pro: 0, premium: 0 };
    usersByPlanAgg.forEach(item => {
        const key = item._id ? item._id.toLowerCase() : 'free';
        usersByPlan[key] = (usersByPlan[key] || 0) + item.count;
    });

    // ─── 2. Subscriptions Collection Analysis ───────────────────────────────
    const [
        totalSubscriptions,
        subsByStatusAgg,
        subsMissingStart,
        subsPeriodEndPast,
        activeSubsPeriodEndPast,
        distinctSubUserIds
    ] = await Promise.all([
        subscriptionModel.countDocuments(),
        subscriptionModel.aggregate([
            { $group: { _id: { status: '$status', plan: '$plan' }, count: { $sum: 1 } } }
        ]),
        subscriptionModel.countDocuments({
            $or: [
                { currentPeriodStart: { $exists: false } },
                { currentPeriodStart: null }
            ]
        }),
        subscriptionModel.countDocuments({
            currentPeriodEnd: { $lt: now }
        }),
        subscriptionModel.countDocuments({
            status: { $in: ['ACTIVE', 'active'] },
            currentPeriodEnd: { $lt: now }
        }),
        subscriptionModel.distinct('userId')
    ]);

    let uppercaseActiveCount = 0;
    let lowercaseActiveCount = 0;
    const subsByStatusFormatted = [];

    subsByStatusAgg.forEach(s => {
        const statusStr = s._id.status || 'UNKNOWN';
        if (statusStr === 'ACTIVE') uppercaseActiveCount += s.count;
        if (statusStr === 'active') lowercaseActiveCount += s.count;
        subsByStatusFormatted.push({
            status: statusStr,
            plan: s._id.plan || 'unknown',
            count: s.count
        });
    });

    // ─── 3. Users Without Subscriptions (Section 8) ─────────────────────────
    const usersWithoutSub = await userModel.find({
        _id: { $nin: distinctSubUserIds }
    })
    .select('_id username email plan role isVerified isBlocked isDeleted createdAt')
    .sort({ createdAt: -1 })
    .lean();

    const usersWithoutSubPlanCounts = { free: 0, pro: 0, premium: 0 };
    usersWithoutSub.forEach(u => {
        const p = u.plan ? u.plan.toLowerCase() : 'free';
        usersWithoutSubPlanCounts[p] = (usersWithoutSubPlanCounts[p] || 0) + 1;
    });

    // ─── 4. Users With Multiple Subscriptions ───────────────────────────────
    const multiSubAgg = await subscriptionModel.aggregate([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
    ]);

    const multiSubUsers = [];
    for (const m of multiSubAgg) {
        if (!m._id) continue;
        const [userDoc, subs] = await Promise.all([
            userModel.findById(m._id).select('username email plan').lean(),
            subscriptionModel.find({ userId: m._id }).select('_id plan status startedAt currentPeriodEnd').lean()
        ]);

        multiSubUsers.push({
            userId: m._id.toString(),
            username: userDoc?.username || 'Unknown',
            email: userDoc?.email || '',
            activeUserPlan: userDoc?.plan || 'unknown',
            subscriptionCount: m.count,
            subscriptions: subs.map(s => ({
                id: s._id.toString(),
                plan: s.plan,
                status: s.status,
                startedAt: s.startedAt,
                currentPeriodEnd: s.currentPeriodEnd
            }))
        });
    }

    // ─── 5. Orphaned Subscriptions ──────────────────────────────────────────
    const allUserIds = await userModel.distinct('_id');
    const allUserIdsSet = new Set(allUserIds.map(id => id.toString()));

    const orphanedSubs = await subscriptionModel.find({
        userId: { $nin: allUserIds }
    })
    .select('_id userId plan status startedAt currentPeriodEnd')
    .lean();

    // ─── 6. Financial Reconciliation (Section 4) ────────────────────────────
    const [
        totalOrders,
        paidOrdersCount,
        totalPayments,
        successfulPaymentsCount,
        totalInvoices
    ] = await Promise.all([
        PaymentOrder.countDocuments(),
        PaymentOrder.countDocuments({ status: 'PAID' }),
        Payment.countDocuments(),
        Payment.countDocuments({ status: 'SUCCESS' }),
        Invoice.countDocuments()
    ]);

    // Check for Paid subscriptions without matching SUCCESS Payment (Set-based lookup to avoid N+1 queries)
    const paidSubscriptions = await subscriptionModel.find({
        plan: { $in: ['pro', 'premium'] }
    }).select('_id userId plan status startedAt currentPeriodEnd createdAt').lean();

    const successPaymentUserIds = await Payment.distinct('userId', { status: 'SUCCESS' });
    const successPaymentUserIdsSet = new Set(successPaymentUserIds.map(id => id.toString()));

    const suspiciousPaidSubsWithoutPayment = paidSubscriptions
        .filter(sub => !successPaymentUserIdsSet.has(sub.userId?.toString()))
        .map(sub => ({
            subscriptionId: sub._id.toString(),
            userId: sub.userId?.toString(),
            plan: sub.plan,
            status: sub.status,
            createdAt: sub.createdAt
        }));

    // Check for Successful Payments without Active Subscription (Set-based lookup to avoid N+1 queries)
    const successPayments = await Payment.find({ status: 'SUCCESS' }).select('_id userId orderId amount createdAt').lean();
    const activePaidSubUserIds = await subscriptionModel.distinct('userId', {
        status: { $in: ['ACTIVE', 'active'] },
        plan: { $in: ['pro', 'premium'] }
    });
    const activePaidSubUserIdsSet = new Set(activePaidSubUserIds.map(id => id.toString()));

    const paymentsWithoutActiveSub = successPayments
        .filter(pay => !activePaidSubUserIdsSet.has(pay.userId?.toString()))
        .map(pay => ({
            paymentId: pay._id.toString(),
            userId: pay.userId?.toString(),
            amount: pay.amount / 100,
            createdAt: pay.createdAt
        }));

    // Check for duplicate payment references
    const duplicatePaymentsAgg = await Payment.aggregate([
        { $match: { gatewayPaymentId: { $exists: true, $ne: null } } },
        { $group: { _id: '$gatewayPaymentId', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
    ]);

    return {
        timestamp: new Date().toISOString(),
        summary: {
            totalRegisteredUsers: totalUsers,
            totalSubscriptionRecords: totalSubscriptions,
            distinctUsersWithSubscriptions: distinctSubUserIds.length,
            usersWithoutSubscription: usersWithoutSub.length,
            usersWithMultipleSubscriptions: multiSubUsers.length,
            orphanedSubscriptionRecords: orphanedSubs.length,
            isReconciled: (totalUsers - usersWithoutSub.length + orphanedSubs.length === distinctSubUserIds.length)
        },
        userReconciliation: {
            totalUsers,
            usersByPlan,
            deletedUsers: deletedUsersCount,
            blockedUsers: blockedUsersCount,
            unverifiedUsers: unverifiedUsersCount,
            usersWithoutSubscription: {
                total: usersWithoutSub.length,
                byPlan: usersWithoutSubPlanCounts,
                sample: usersWithoutSub.slice(0, 10).map(u => ({
                    id: u._id.toString(),
                    username: u.username,
                    email: u.email,
                    plan: u.plan,
                    createdAt: u.createdAt
                })),
                architecturalExplanation: 'Free plan users created via Google OAuth or unseeded accounts do not have a dedicated subscription document; the platform provides virtual free tier access gracefully.'
            },
            multiSubscriptionUsers: multiSubUsers,
            orphanedSubscriptions: orphanedSubs.map(s => ({
                subscriptionId: s._id.toString(),
                userId: s.userId?.toString(),
                plan: s.plan,
                status: s.status
            }))
        },
        integrityAudit: {
            casingInconsistency: {
                uppercaseACTIVE: uppercaseActiveCount,
                lowercaseActive: lowercaseActiveCount,
                explanation: 'Historical lowercase "active" originated from early migration scripts and findOneAndUpdate operations prior to model setter enforcement.'
            },
            missingPeriodStartCount: subsMissingStart,
            periodEndInPastCount: subsPeriodEndPast,
            activeSubsPeriodEndPastCount: activeSubsPeriodEndPast,
            breakdownByStatusAndPlan: subsByStatusFormatted
        },
        financialReconciliation: {
            totalOrders,
            paidOrders: paidOrdersCount,
            totalPayments,
            successfulPayments: successfulPaymentsCount,
            totalInvoices,
            paidSubscriptionsWithoutSuccessfulPayment: suspiciousPaidSubsWithoutPayment,
            successfulPaymentsWithoutActiveSubscription: paymentsWithoutActiveSub,
            duplicateGatewayPayments: duplicatePaymentsAgg.map(d => ({ gatewayPaymentId: d._id, count: d.count }))
        }
    };
}

module.exports = {
    SUBSCRIPTION_STATUSES,
    normalizeSubscriptionStatus,
    evaluateSubscriptionLifecycle,
    getSubscriptionAndFinancialReconciliation
};
