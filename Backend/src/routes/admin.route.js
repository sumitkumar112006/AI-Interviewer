const express = require('express');
const { authUser, requireAdmin, requireSuperAdmin } = require('../middleware/auth.middleware');
const {
    adminActionLimiter,
    adminCreationLimiter,
    adminSensitiveLimiter
} = require('../middleware/rateLimiter.middleware');
const { requirePermission, PERMISSIONS } = require('../middleware/rbac.middleware');
const {
    getAdminStatsController,
    getAdminUsersController,
    updateUserRoleController,
    createAdminAccountController,
    updateUserPlanController,
    toggleUserBlockController,
    grantUserCreditsController,
    updateUserFeatureAccessController,
    getUserByIdController,
    adjustUserCreditsController,
    sendAdminMessageController,
    getAdminPaymentsController,
    getAdminSubscriptionsController,
    getSubscriptionReconciliationController,
    getAdminAuditLogsController,
    getAdminSystemEventsController,
    getAdminSystemHealthController,
    getAdminSettingsController,
    updateAdminSettingsController,
    rollbackAdminVersionController,
    getAdminInvoicesController,
    deleteUserController,
    exportAdminDataController,
    getUserActivityAnalyticsController
} = require('../controller/admin.controller');
const {
    getAdminJobsController,
    getAdminJobDetailsController,
    retryAdminJobController,
    cancelAdminJobController
} = require('../controller/adminJobs.controller');
const {
    getAdminSupportTicketsController,
    getAdminSupportTicketDetailsController,
    assignAdminSupportTicketController,
    updateAdminSupportTicketStatusController,
    addAdminInternalNoteController,
    replyAdminSupportTicketController
} = require('../controller/adminSupport.controller');
const {
    getAdminAtsAnalyticsController
} = require('../controller/atsAnalytics.controller');
const {
    getAdminUserSessionsController,
    revokeAdminSessionController,
    revokeAllAdminUserSessionsController
} = require('../controller/session.controller');
const {
    getAiUsageSummaryController,
    getAiUsageLogsController
} = require('../controller/aiUsage.controller');
const {
    listCouponsController,
    createCouponController,
    getCouponDetailsController,
    updateCouponController,
    toggleCouponStatusController
} = require('../controller/coupon.controller');

const adminRouter = express.Router();

// Base administrative gate: enforce authentication, base admin privileges, and global rate limit
adminRouter.use(authUser, requireAdmin, adminActionLimiter);

/**
 * @route DELETE /api/admin/users/:userId
 * @description Completely delete or archive a user account
 * @access Private (Permission: users.delete)
 */
adminRouter.delete('/users/:userId', adminSensitiveLimiter, requirePermission(PERMISSIONS.USERS_DELETE), deleteUserController);

/**
 * @route GET /api/admin/stats
 * @description Get overall platform statistics
 * @access Private (Permission: analytics.read)
 */
adminRouter.get('/stats', requirePermission(PERMISSIONS.ANALYTICS_READ), getAdminStatsController);

/**
 * @route GET /api/admin/analytics/ats
 * @description Get global aggregated ATS scores, distribution and trends
 * @access Private (Permission: analytics.read)
 */
adminRouter.get('/analytics/ats', requirePermission(PERMISSIONS.ANALYTICS_READ), getAdminAtsAnalyticsController);

/**
 * @route GET /api/admin/analytics/ai-usage
 * @description Get aggregated AI token and cost monitoring analytics
 * @access Private (Permission: analytics.read)
 */
adminRouter.get('/analytics/ai-usage', requirePermission(PERMISSIONS.ANALYTICS_READ), getAiUsageSummaryController);

/**
 * @route GET /api/admin/analytics/ai-usage/logs
 * @description Get paginated raw AI usage logs
 * @access Private (Permission: analytics.read)
 */
adminRouter.get('/analytics/ai-usage/logs', requirePermission(PERMISSIONS.ANALYTICS_READ), getAiUsageLogsController);

/**
 * @route GET /api/admin/analytics/user-activity
 * @description Get comprehensive authenticated user activity telemetry (DAU, WAU, MAU, Dormant, New, Returning)
 * @access Private (Permission: analytics.read)
 */
adminRouter.get('/analytics/user-activity', requirePermission(PERMISSIONS.ANALYTICS_READ), getUserActivityAnalyticsController);

/**
 * @route GET /api/admin/users
 * @description Search, filter & list all users
 * @access Private (Permission: users.read)
 */
adminRouter.get('/users', requirePermission(PERMISSIONS.USERS_READ), getAdminUsersController);

/**
 * @route POST /api/admin/create-admin
 * @description Create a brand new admin account
 * @access Private (Permission: admins.manage)
 */
adminRouter.post('/create-admin', adminCreationLimiter, requirePermission(PERMISSIONS.ADMINS_MANAGE), createAdminAccountController);

/**
 * @route PATCH /api/admin/users/:userId/role
 * @description Update user role
 * @access Private (Permission: admins.manage)
 */
adminRouter.patch('/users/:userId/role', adminSensitiveLimiter, requirePermission(PERMISSIONS.ADMINS_MANAGE), updateUserRoleController);

/**
 * @route PATCH /api/admin/users/:userId/plan
 * @description Update user subscription plan
 * @access Private (Permission: users.update)
 */
adminRouter.patch('/users/:userId/plan', requirePermission(PERMISSIONS.USERS_UPDATE), updateUserPlanController);

/**
 * @route PATCH /api/admin/users/:userId/block
 * @description Block or unblock a user account
 * @access Private (Permission: users.suspend)
 */
adminRouter.patch('/users/:userId/block', adminSensitiveLimiter, requirePermission(PERMISSIONS.USERS_SUSPEND), toggleUserBlockController);

/**
 * @route PATCH /api/admin/users/:userId/feature-access
 * @description Toggle feature access booleans for user
 * @access Private (Permission: users.update)
 */
adminRouter.patch('/users/:userId/feature-access', requirePermission(PERMISSIONS.USERS_UPDATE), updateUserFeatureAccessController);

/**
 * @route POST /api/admin/users/credits
 * @description Grant custom bonus credits to user
 * @access Private (Permission: users.update)
 */
adminRouter.post('/users/credits', adminSensitiveLimiter, requirePermission(PERMISSIONS.USERS_UPDATE), grantUserCreditsController);

/**
 * @route GET /api/admin/users/:userId
 * @description Get detailed user profile by ID
 * @access Private (Permission: users.read)
 */
adminRouter.get('/users/:userId', requirePermission(PERMISSIONS.USERS_READ), getUserByIdController);

/**
 * @route POST /api/admin/users/:userId/credits
 * @description Increase or reduce bonus credits for a specific user
 * @access Private (Permission: users.update)
 */
adminRouter.post('/users/:userId/credits', adminSensitiveLimiter, requirePermission(PERMISSIONS.USERS_UPDATE), adjustUserCreditsController);

/**
 * @route POST /api/admin/broadcast-message
 * @description Send notification message to users
 * @access Private (Permission: settings.update)
 */
adminRouter.post('/broadcast-message', requirePermission(PERMISSIONS.SETTINGS_UPDATE), sendAdminMessageController);

/**
 * @route GET /api/admin/payments
 * @description Get all payments with status filtering & revenue metrics
 * @access Private (Permission: billing.read)
 */
adminRouter.get('/payments', requirePermission(PERMISSIONS.BILLING_READ), getAdminPaymentsController);

/**
 * @route GET /api/admin/subscriptions
 * @description Get all subscriptions with tier breakdowns
 * @access Private (Permission: billing.read)
 */
adminRouter.get('/subscriptions', requirePermission(PERMISSIONS.BILLING_READ), getAdminSubscriptionsController);

/**
 * @route GET /api/admin/subscriptions/reconciliation
 * @description Forensic diagnostic reconciliation across Users, Subscriptions, Payments, and Invoices
 * @access Private (Permission: billing.read)
 */
adminRouter.get('/subscriptions/reconciliation', requirePermission(PERMISSIONS.BILLING_READ), getSubscriptionReconciliationController);

/**
 * @route GET /api/admin/coupons
 * @description List platform coupons with filtering and aggregated stats
 * @access Private (Permission: billing.read)
 */
adminRouter.get('/coupons', requirePermission(PERMISSIONS.BILLING_READ), listCouponsController);

/**
 * @route POST /api/admin/coupons
 * @description Create a new coupon code
 * @access Private (Permission: billing.manage)
 */
adminRouter.post('/coupons', adminSensitiveLimiter, requirePermission(PERMISSIONS.BILLING_MANAGE), createCouponController);

/**
 * @route GET /api/admin/coupons/:couponId
 * @description Get details and redemptions for a single coupon
 * @access Private (Permission: billing.read)
 */
adminRouter.get('/coupons/:couponId', requirePermission(PERMISSIONS.BILLING_READ), getCouponDetailsController);

/**
 * @route PUT /api/admin/coupons/:couponId
 * @description Update editable fields on a coupon
 * @access Private (Permission: billing.manage)
 */
adminRouter.put('/coupons/:couponId', adminSensitiveLimiter, requirePermission(PERMISSIONS.BILLING_MANAGE), updateCouponController);

/**
 * @route PATCH /api/admin/coupons/:couponId/status
 * @description Toggle active/inactive status of a coupon
 * @access Private (Permission: billing.manage)
 */
adminRouter.patch('/coupons/:couponId/status', adminSensitiveLimiter, requirePermission(PERMISSIONS.BILLING_MANAGE), toggleCouponStatusController);

/**
 * @route GET /api/admin/audit-logs
 * @description Get subscription & payment audit transition events
 * @access Private (Permission: audit.read)
 */
adminRouter.get('/audit-logs', requirePermission(PERMISSIONS.AUDIT_READ), getAdminAuditLogsController);

/**
 * @route GET /api/admin/system-events
 * @description Get operational system events and audit trail
 * @access Private (Permission: audit.read)
 */
adminRouter.get('/system-events', requirePermission(PERMISSIONS.AUDIT_READ), getAdminSystemEventsController);

/**
 * @route GET /api/admin/system-health
 * @description Get real-time health telemetry across all platform subsystems
 * @access Private (Permission: audit.read)
 */
adminRouter.get('/system-health', requirePermission(PERMISSIONS.AUDIT_READ), getAdminSystemHealthController);

/**
 * @route GET /api/admin/settings
 * @description Retrieve active platform configuration settings
 * @access Private (Permission: settings.read)
 */
adminRouter.get('/settings', requirePermission(PERMISSIONS.SETTINGS_READ), getAdminSettingsController);

/**
 * @route PUT /api/admin/settings
 * @description Update platform configuration settings (maintenance, kill switches, registration, AI provider, quotas)
 * @access Private (Permission: settings.update)
 */
adminRouter.put('/settings', adminSensitiveLimiter, requirePermission(PERMISSIONS.SETTINGS_UPDATE), updateAdminSettingsController);

/**
 * @route POST /api/admin/settings/version/rollback
 * @description Roll back version configuration to previous state
 * @access Private (Permission: settings.update)
 */
adminRouter.post('/settings/version/rollback', adminSensitiveLimiter, requirePermission(PERMISSIONS.SETTINGS_UPDATE), rollbackAdminVersionController);

/**
 * @route GET /api/admin/invoices
 * @description Get all tax invoices
 * @access Private (Permission: invoices.read)
 */
adminRouter.get('/invoices', requirePermission(PERMISSIONS.INVOICES_READ), getAdminInvoicesController);

/**
 * @route GET /api/admin/invoices/:id/pdf
 * @description Render printable view for an invoice as admin
 * @access Private (Permission: invoices.read)
 */
adminRouter.get('/invoices/:id/pdf', requirePermission(PERMISSIONS.INVOICES_READ), (req, res, next) => {
    const invoiceController = require('../controller/invoice.controller');
    return invoiceController.getInvoiceHtmlOrPdf(req, res, next);
});

/**
 * @route GET /api/admin/export/:moduleName
 * @description Securely stream CSV or XLSX exports for admin modules
 * @access Private (Permission: exports.create)
 */
adminRouter.get('/export/:moduleName', adminSensitiveLimiter, requirePermission(PERMISSIONS.EXPORTS_CREATE), exportAdminDataController);

/**
 * @route GET /api/admin/jobs
 * @description Get background jobs with filtering, pagination and queue metrics
 * @access Private (Permission: jobs.read)
 */
adminRouter.get('/jobs', requirePermission(PERMISSIONS.JOBS_READ), getAdminJobsController);

/**
 * @route GET /api/admin/jobs/:jobId
 * @description Get sanitized background job inspection details
 * @access Private (Permission: jobs.read)
 */
adminRouter.get('/jobs/:jobId', requirePermission(PERMISSIONS.JOBS_READ), getAdminJobDetailsController);

/**
 * @route POST /api/admin/jobs/:jobId/retry
 * @description Safely retry an eligible failed background job
 * @access Private (Permission: jobs.retry)
 */
adminRouter.post('/jobs/:jobId/retry', adminSensitiveLimiter, requirePermission(PERMISSIONS.JOBS_RETRY), retryAdminJobController);

/**
 * @route POST /api/admin/jobs/:jobId/cancel
 * @description Safely cancel a pending or processing background job
 * @access Private (Permission: jobs.retry)
 */
adminRouter.post('/jobs/:jobId/cancel', adminSensitiveLimiter, requirePermission(PERMISSIONS.JOBS_RETRY), cancelAdminJobController);

/**
 * @route GET /api/admin/support/tickets
 * @description Get support tickets with status, priority, and assignment filters
 * @access Private (Permission: support.read)
 */
adminRouter.get('/support/tickets', requirePermission(PERMISSIONS.SUPPORT_READ), getAdminSupportTicketsController);

/**
 * @route GET /api/admin/support/tickets/:ticketId
 * @description Get complete diagnostic ticket details, response history and internal notes
 * @access Private (Permission: support.read)
 */
adminRouter.get('/support/tickets/:ticketId', requirePermission(PERMISSIONS.SUPPORT_READ), getAdminSupportTicketDetailsController);

/**
 * @route PATCH /api/admin/support/tickets/:ticketId/assign
 * @description Assign or reassign ticket to an administrator
 * @access Private (Permission: support.manage)
 */
adminRouter.patch('/support/tickets/:ticketId/assign', adminSensitiveLimiter, requirePermission(PERMISSIONS.SUPPORT_MANAGE), assignAdminSupportTicketController);

/**
 * @route PATCH /api/admin/support/tickets/:ticketId/status
 * @description Update ticket status or priority
 * @access Private (Permission: support.manage)
 */
adminRouter.patch('/support/tickets/:ticketId/status', adminSensitiveLimiter, requirePermission(PERMISSIONS.SUPPORT_MANAGE), updateAdminSupportTicketStatusController);

/**
 * @route POST /api/admin/support/tickets/:ticketId/notes
 * @description Add private internal staff note to ticket
 * @access Private (Permission: support.manage)
 */
adminRouter.post('/support/tickets/:ticketId/notes', requirePermission(PERMISSIONS.SUPPORT_MANAGE), addAdminInternalNoteController);

/**
 * @route POST /api/admin/support/tickets/:ticketId/reply
 * @description Post response to customer and notify via email
 * @access Private (Permission: support.manage)
 */
adminRouter.post('/support/tickets/:ticketId/reply', requirePermission(PERMISSIONS.SUPPORT_MANAGE), replyAdminSupportTicketController);

/**
 * Session & Device Management (Admin)
 */
adminRouter.get('/users/:userId/sessions', requirePermission(PERMISSIONS.USERS_READ), getAdminUserSessionsController);
adminRouter.post('/sessions/:sessionId/revoke', adminSensitiveLimiter, requirePermission(PERMISSIONS.USERS_SUSPEND), revokeAdminSessionController);
adminRouter.post('/users/:userId/sessions/revoke-all', adminSensitiveLimiter, requirePermission(PERMISSIONS.USERS_SUSPEND), revokeAllAdminUserSessionsController);

module.exports = adminRouter;
