/**
 * adminAnalytics.controller.js — Admin Analytics HTTP Controllers
 */

'use strict';

const {
    getOverviewAnalytics,
    getTrafficAnalytics,
    getRegistrationAnalytics,
    getRevenueAnalytics,
    getPlanAnalytics,
    getFeatureUsageAnalytics,
    getActivityHeatmapAnalytics,
    getRecentUsersTable
} = require('../services/adminAnalytics.service');

async function getOverviewAnalyticsController(req, res) {
    try {
        const { timeframe, startDate, endDate } = req.query;
        const data = await getOverviewAnalytics({ timeframe, startDate, endDate });
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('[ADMIN ANALYTICS OVERVIEW ERROR]', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch overview analytics' });
    }
}

async function getTrafficAnalyticsController(req, res) {
    try {
        const { timeframe, startDate, endDate } = req.query;
        const data = await getTrafficAnalytics({ timeframe, startDate, endDate });
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('[ADMIN ANALYTICS TRAFFIC ERROR]', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch traffic analytics' });
    }
}

async function getRegistrationAnalyticsController(req, res) {
    try {
        const { timeframe, startDate, endDate } = req.query;
        const data = await getRegistrationAnalytics({ timeframe, startDate, endDate });
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('[ADMIN ANALYTICS REGISTRATIONS ERROR]', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch registration analytics' });
    }
}

async function getRevenueAnalyticsController(req, res) {
    try {
        const { timeframe, startDate, endDate } = req.query;
        const data = await getRevenueAnalytics({ timeframe, startDate, endDate });
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('[ADMIN ANALYTICS REVENUE ERROR]', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch revenue analytics' });
    }
}

async function getPlanAnalyticsController(req, res) {
    try {
        const data = await getPlanAnalytics();
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('[ADMIN ANALYTICS PLANS ERROR]', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch plan analytics' });
    }
}

async function getFeatureUsageAnalyticsController(req, res) {
    try {
        const { timeframe } = req.query;
        const data = await getFeatureUsageAnalytics({ timeframe });
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('[ADMIN ANALYTICS FEATURE USAGE ERROR]', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch feature usage analytics' });
    }
}

async function getActivityHeatmapAnalyticsController(req, res) {
    try {
        const { days } = req.query;
        const data = await getActivityHeatmapAnalytics({ days });
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('[ADMIN ANALYTICS HEATMAP ERROR]', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch activity heatmap' });
    }
}

async function getRecentUsersAnalyticsController(req, res) {
    try {
        const { page, limit, search, plan, status, sortBy, sortOrder } = req.query;
        const data = await getRecentUsersTable({
            page,
            limit,
            search,
            plan,
            status,
            sortBy,
            sortOrder
        });
        return res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('[ADMIN ANALYTICS RECENT USERS ERROR]', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch recent users' });
    }
}

module.exports = {
    getOverviewAnalyticsController,
    getTrafficAnalyticsController,
    getRegistrationAnalyticsController,
    getRevenueAnalyticsController,
    getPlanAnalyticsController,
    getFeatureUsageAnalyticsController,
    getActivityHeatmapAnalyticsController,
    getRecentUsersAnalyticsController
};

