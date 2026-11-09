/**
 * moderation.controller.js — Content Moderation Admin & Appeal Controller
 */

'use strict';

const moderationService = require('../services/moderation.service');

/**
 * Get paginated moderation queue
 * GET /api/admin/moderation
 */
async function getModerationQueueController(req, res) {
    try {
        const { status, category, severity, search, page, limit } = req.query;

        const result = await moderationService.getModerationQueue({
            status,
            category,
            severity,
            search,
            page,
            limit
        });

        return res.status(200).json({
            success: true,
            data: result.records,
            total: result.total,
            page: result.page,
            totalPages: result.totalPages
        });
    } catch (err) {
        console.error('[MODERATION_CONTROLLER] getModerationQueue error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch moderation queue.' });
    }
}

/**
 * Get moderation summary stats
 * GET /api/admin/moderation/stats
 */
async function getModerationStatsController(req, res) {
    try {
        const stats = await moderationService.getModerationStats();
        return res.status(200).json({
            success: true,
            data: stats
        });
    } catch (err) {
        console.error('[MODERATION_CONTROLLER] getModerationStats error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to fetch moderation statistics.' });
    }
}

/**
 * Get single moderation record details
 * GET /api/admin/moderation/:id
 */
async function getModerationDetailsController(req, res) {
    try {
        const { id } = req.params;
        const record = await moderationService.getModerationRecordById(id);
        return res.status(200).json({
            success: true,
            data: record
        });
    } catch (err) {
        return res.status(err.message.includes('not found') ? 404 : 500).json({
            success: false,
            message: err.message
        });
    }
}

/**
 * Apply admin moderation decision
 * POST /api/admin/moderation/:id/decision
 */
async function applyModerationDecisionController(req, res) {
    try {
        const { id } = req.params;
        const { decision, notes, targetFeature } = req.body;

        const reviewerId = req.user?._id || req.user?.id;
        const updated = await moderationService.applyModerationDecision(
            id,
            { decision, notes, targetFeature },
            { reviewerId, req }
        );

        return res.status(200).json({
            success: true,
            message: 'Moderation decision applied successfully.',
            data: updated
        });
    } catch (err) {
        console.error('[MODERATION_CONTROLLER] applyDecision error:', err);
        return res.status(err.message.includes('not found') ? 404 : 400).json({
            success: false,
            message: err.message
        });
    }
}

/**
 * Submit appeal by candidate/user
 * POST /api/moderation/:id/appeal
 */
async function submitAppealController(req, res) {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user?._id || req.user?.id;

        const record = await moderationService.submitAppeal(
            id,
            { reason },
            { userId }
        );

        return res.status(200).json({
            success: true,
            message: 'Appeal submitted successfully and will be reviewed by administrators.',
            data: record
        });
    } catch (err) {
        return res.status(err.message.includes('not authorized') ? 403 : 400).json({
            success: false,
            message: err.message
        });
    }
}

/**
 * Review user appeal by admin
 * POST /api/admin/moderation/:id/appeal-review
 */
async function reviewAppealController(req, res) {
    try {
        const { id } = req.params;
        const { approved, notes, restoreUser } = req.body;
        const reviewerId = req.user?._id || req.user?.id;

        const record = await moderationService.reviewAppeal(
            id,
            { approved, notes, restoreUser },
            { reviewerId, req }
        );

        return res.status(200).json({
            success: true,
            message: `Appeal has been ${approved ? 'approved' : 'rejected'}.`,
            data: record
        });
    } catch (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
}

module.exports = {
    getModerationQueueController,
    getModerationStatsController,
    getModerationDetailsController,
    applyModerationDecisionController,
    submitAppealController,
    reviewAppealController
};

