/**
 * moderation.route.js — Content Moderation System Endpoints
 */

'use strict';

const express = require('express');
const { authUser, requireAdmin } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const { PERMISSIONS } = require('../config/rbac.config');
const {
    getModerationQueueController,
    getModerationStatsController,
    getModerationDetailsController,
    applyModerationDecisionController,
    submitAppealController,
    reviewAppealController
} = require('../controller/moderation.controller');

const moderationRouter = express.Router();

// ── Admin Moderation Endpoints ──────────────────────────────────────────────
moderationRouter.get(
    '/admin/moderation',
    authUser,
    requireAdmin,
    requirePermission(PERMISSIONS.MODERATION_READ),
    getModerationQueueController
);

moderationRouter.get(
    '/admin/moderation/stats',
    authUser,
    requireAdmin,
    requirePermission(PERMISSIONS.MODERATION_READ),
    getModerationStatsController
);

moderationRouter.get(
    '/admin/moderation/:id',
    authUser,
    requireAdmin,
    requirePermission(PERMISSIONS.MODERATION_READ),
    getModerationDetailsController
);

moderationRouter.post(
    '/admin/moderation/:id/decision',
    authUser,
    requireAdmin,
    requirePermission(PERMISSIONS.MODERATION_MANAGE),
    applyModerationDecisionController
);

moderationRouter.post(
    '/admin/moderation/:id/appeal-review',
    authUser,
    requireAdmin,
    requirePermission(PERMISSIONS.MODERATION_MANAGE),
    reviewAppealController
);

// ── User Appeal Submission Endpoint ─────────────────────────────────────────
moderationRouter.post(
    '/moderation/:id/appeal',
    authUser,
    submitAppealController
);

module.exports = moderationRouter;

