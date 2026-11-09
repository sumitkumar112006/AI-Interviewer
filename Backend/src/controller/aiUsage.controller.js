/**
 * aiUsage.controller.js — Admin Controller for AI Usage, Token Telemetry, and Cost Monitoring
 *
 * Implements:
 * 1. Aggregated KPI summaries, trends, and provider/feature breakdowns.
 * 2. Drill-down inspection of paginated usage logs.
 * 3. Cache control and query validation.
 */

'use strict';

const aiUsageService = require('../services/aiUsage.service');

/**
 * GET /api/admin/analytics/ai-usage
 * Retrieve high-level summary KPIs, provider/model distribution, feature breakdown, and trends.
 */
async function getAiUsageSummaryController(req, res) {
    try {
        const { startDate, endDate, feature, provider, model, refresh } = req.query;

        const bypassCache = refresh === 'true' || refresh === '1';

        const data = await aiUsageService.getAiUsageAnalytics({
            startDate: startDate ? String(startDate) : undefined,
            endDate: endDate ? String(endDate) : undefined,
            feature: feature ? String(feature) : undefined,
            provider: provider ? String(provider) : undefined,
            model: model ? String(model) : undefined,
            refresh: bypassCache
        });

        return res.status(200).json({
            success: true,
            cached: !bypassCache,
            ...data
        });
    } catch (err) {
        console.error('[AI Usage Controller] getAiUsageSummary error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to aggregate AI token and cost metrics',
            error: err.message
        });
    }
}

/**
 * GET /api/admin/analytics/ai-usage/logs
 * Retrieve paginated raw usage logs for operational inspection.
 */
async function getAiUsageLogsController(req, res) {
    try {
        const { page, limit, status, provider, feature, startDate, endDate } = req.query;

        const data = await aiUsageService.getAiUsageLogs({
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            status: status ? String(status) : undefined,
            provider: provider ? String(provider) : undefined,
            feature: feature ? String(feature) : undefined,
            startDate: startDate ? String(startDate) : undefined,
            endDate: endDate ? String(endDate) : undefined
        });

        return res.status(200).json({
            success: true,
            ...data
        });
    } catch (err) {
        console.error('[AI Usage Controller] getAiUsageLogs error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve AI usage logs',
            error: err.message
        });
    }
}

module.exports = {
    getAiUsageSummaryController,
    getAiUsageLogsController
};

