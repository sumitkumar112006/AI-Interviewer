/**
 * organization.route.js — B2B Partner & Organization Management Routes
 *
 * Implements:
 * - Partner Directory and CRUD (Platform Admins with organizations.read / organizations.manage)
 * - Status activation / suspension controls
 * - Organization Administrator assignments
 * - Tenant-isolated usage analytics and candidate seat rosters
 */

'use strict';

const express = require('express');
const router = express.Router();
const { authUser, requireAdmin, requireOrgAccess } = require('../middleware/auth.middleware');
const { requirePermission, PERMISSIONS } = require('../middleware/rbac.middleware');
const { adminSensitiveLimiter, adminActionLimiter } = require('../middleware/rateLimiter.middleware');
const orgController = require('../controller/organization.controller');

/**
 * Platform Administrator Partner Management Routes
 */
router.get(
    '/',
    authUser,
    requireAdmin,
    requirePermission(PERMISSIONS.ORGANIZATIONS_READ),
    orgController.getOrganizationsController
);

router.post(
    '/',
    authUser,
    requireAdmin,
    adminSensitiveLimiter,
    requirePermission(PERMISSIONS.ORGANIZATIONS_MANAGE),
    orgController.createOrganizationController
);

router.get(
    '/:orgId',
    authUser,
    requireOrgAccess('orgId'),
    orgController.getOrganizationByIdController
);

router.put(
    '/:orgId',
    authUser,
    requireAdmin,
    adminSensitiveLimiter,
    requirePermission(PERMISSIONS.ORGANIZATIONS_MANAGE),
    orgController.updateOrganizationController
);

router.patch(
    '/:orgId/status',
    authUser,
    requireAdmin,
    adminSensitiveLimiter,
    requirePermission(PERMISSIONS.ORGANIZATIONS_MANAGE),
    orgController.setOrganizationStatusController
);

router.post(
    '/:orgId/admins',
    authUser,
    requireAdmin,
    adminSensitiveLimiter,
    requirePermission(PERMISSIONS.ORGANIZATIONS_MANAGE),
    orgController.assignOrgAdminController
);

router.delete(
    '/:orgId/admins/:userId',
    authUser,
    requireAdmin,
    adminSensitiveLimiter,
    requirePermission(PERMISSIONS.ORGANIZATIONS_MANAGE),
    orgController.removeOrgAdminController
);

/**
 * Tenant-Isolated Organization Metrics & Cohort Roster Routes
 * (Permits Platform Administrators OR authenticated Organization Administrators)
 */
router.get(
    '/:orgId/stats',
    authUser,
    requireOrgAccess('orgId'),
    orgController.getOrganizationStatsController
);

router.get(
    '/:orgId/members',
    authUser,
    requireOrgAccess('orgId'),
    orgController.getOrganizationMembersController
);

router.post(
    '/:orgId/members',
    authUser,
    requireOrgAccess('orgId'),
    adminActionLimiter,
    orgController.addOrgMemberController
);

router.delete(
    '/:orgId/members/:userId',
    authUser,
    requireOrgAccess('orgId'),
    adminActionLimiter,
    orgController.removeOrgMemberController
);

module.exports = router;

