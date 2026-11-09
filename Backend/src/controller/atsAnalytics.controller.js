/**
 * atsAnalytics.controller.js — Admin Controller for Global ATS Analytics
 *
 * Implements:
 * 1. Endpoint handling for platform-wide ATS analytics queries.
 * 2. Date filtering & on-demand cache refresh.
 * 3. Graceful error handling and response formatting.
 */

'use strict';

const atsAnalyticsService = require('../services/atsAnalytics.service');

/**
 * @name getAdminAtsAnalyticsController
 * @route GET /api/admin/analytics/ats
 * @access Private (Permission: analytics.read)
 */
async function getAdminAtsAnalyticsController(req, res) {
    try {
        const { startDate, endDate, refresh } = req.query;
        const bypassCache = refresh === 'true' || refresh === '1';

        const analytics = await atsAnalyticsService.getGlobalAtsAnalytics({
            startDate,
            endDate,
            bypassCache
        });

        return res.status(200).json({
            success: true,
            ...analytics
        });
    } catch (err) {
        console.error('[getAdminAtsAnalyticsController] Error:', err.message);
        return res.status(500).json({ message: 'Failed to compute global ATS analytics.' });
    }
}

module.exports = {
    getAdminAtsAnalyticsController
};

