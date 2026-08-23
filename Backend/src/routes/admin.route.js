const express = require('express');
const { authUser, requireAdmin } = require('../middleware/auth.middleware');
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
    sendAdminMessageController
} = require('../controller/admin.controller');

const adminRouter = express.Router();

// Apply authUser & requireAdmin to all admin endpoints
adminRouter.use(authUser, requireAdmin);

/**
 * @route GET /api/admin/stats
 * @description Get overall platform statistics
 * @access Private (Admin Only)
 */
adminRouter.get('/stats', getAdminStatsController);

/**
 * @route GET /api/admin/users
 * @description Search, filter & list all users
 * @access Private (Admin Only)
 */
adminRouter.get('/users', getAdminUsersController);

/**
 * @route POST /api/admin/create-admin
 * @description Create a brand new admin in the admins collection
 * @access Private (Admin Only)
 */
adminRouter.post('/create-admin', createAdminAccountController);

/**
 * @route PATCH /api/admin/users/:userId/role
 * @description Update user role ('user' / 'admin' / 'super_admin')
 * @access Private (Admin Only)
 */
adminRouter.patch('/users/:userId/role', updateUserRoleController);

/**
 * @route PATCH /api/admin/users/:userId/plan
 * @description Update user subscription plan ('free' / 'pro' / 'premium')
 * @access Private (Admin Only)
 */
adminRouter.patch('/users/:userId/plan', updateUserPlanController);

/**
 * @route PATCH /api/admin/users/:userId/block
 * @description Block or unblock a user account
 * @access Private (Admin Only)
 */
adminRouter.patch('/users/:userId/block', toggleUserBlockController);

/**
 * @route PATCH /api/admin/users/:userId/feature-access
 * @description Toggle feature access booleans for user
 * @access Private (Admin Only)
 */
adminRouter.patch('/users/:userId/feature-access', updateUserFeatureAccessController);

/**
 * @route POST /api/admin/users/credits
 * @description Grant custom bonus credits to user by email or ID
 * @access Private (Admin Only)
 */
adminRouter.post('/users/credits', grantUserCreditsController);

/**
 * @route GET /api/admin/users/:userId
 * @description Get detailed user profile by ID for evaluation
 * @access Private (Admin Only)
 */
adminRouter.get('/users/:userId', getUserByIdController);

/**
 * @route POST /api/admin/users/:userId/credits
 * @description Increase or reduce bonus credits for a specific user
 * @access Private (Admin Only)
 */
adminRouter.post('/users/:userId/credits', adjustUserCreditsController);

/**
 * @route POST /api/admin/broadcast-message
 * @description Send notification message to single user, plan users, or all users
 * @access Private (Admin Only)
 */
adminRouter.post('/broadcast-message', sendAdminMessageController);

module.exports = adminRouter;
