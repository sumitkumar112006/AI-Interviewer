/**
 * coupon.controller.js — Admin Coupon & Discount Management Controller
 *
 * Implements:
 * 1. Admin endpoints for coupon creation, updates, and activation toggling.
 * 2. Search, status filtering, and paginated coupon listings with redemption analytics.
 * 3. Individual coupon redemption logs and drilldown.
 */

'use strict';

const couponService = require('../services/coupon.service');

/**
 * GET /api/admin/coupons
 * List all platform coupons with status filters and aggregated redemption metrics
 * @access Private (Permission: billing.read)
 */
async function listCouponsController(req, res) {
    try {
        const result = await couponService.listCoupons(req.query);
        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (err) {
        console.error('[COUPON CONTROLLER ERROR]', err);
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Failed to list coupons.'
        });
    }
}

/**
 * POST /api/admin/coupons
 * Create a new coupon code
 * @access Private (Permission: billing.manage)
 */
async function createCouponController(req, res) {
    try {
        const coupon = await couponService.createCoupon(req.body, {
            actorId: req.user?._id,
            actorUsername: req.user?.username || 'admin',
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(201).json({
            success: true,
            message: `Coupon "${coupon.code}" created successfully.`,
            coupon
        });
    } catch (err) {
        console.error('[COUPON CONTROLLER ERROR]', err);
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || 'Failed to create coupon.'
        });
    }
}

/**
 * GET /api/admin/coupons/:couponId
 * Retrieve coupon details and recent redemptions
 * @access Private (Permission: billing.read)
 */
async function getCouponDetailsController(req, res) {
    try {
        const { couponId } = req.params;
        const details = await couponService.getCouponDetails(couponId);
        return res.status(200).json({
            success: true,
            data: details
        });
    } catch (err) {
        console.error('[COUPON CONTROLLER ERROR]', err);
        return res.status(err.status || 404).json({
            success: false,
            message: err.message || 'Coupon not found.'
        });
    }
}

/**
 * PUT /api/admin/coupons/:couponId
 * Update editable coupon fields
 * @access Private (Permission: billing.manage)
 */
async function updateCouponController(req, res) {
    try {
        const { couponId } = req.params;
        const updated = await couponService.updateCoupon(couponId, req.body, {
            actorId: req.user?._id,
            actorUsername: req.user?.username || 'admin',
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(200).json({
            success: true,
            message: `Coupon "${updated.code}" updated successfully.`,
            coupon: updated
        });
    } catch (err) {
        console.error('[COUPON CONTROLLER ERROR]', err);
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || 'Failed to update coupon.'
        });
    }
}

/**
 * PATCH /api/admin/coupons/:couponId/status
 * Activate or deactivate a coupon
 * @access Private (Permission: billing.manage)
 */
async function toggleCouponStatusController(req, res) {
    try {
        const { couponId } = req.params;
        const { isActive } = req.body;

        const updated = await couponService.toggleCouponStatus(couponId, isActive, {
            actorId: req.user?._id,
            actorUsername: req.user?.username || 'admin',
            actorRole: req.user?.role || 'admin',
            req
        });

        return res.status(200).json({
            success: true,
            message: `Coupon "${updated.code}" is now ${updated.isActive ? 'active' : 'inactive'}.`,
            coupon: updated
        });
    } catch (err) {
        console.error('[COUPON CONTROLLER ERROR]', err);
        return res.status(err.status || 400).json({
            success: false,
            message: err.message || 'Failed to toggle coupon status.'
        });
    }
}

module.exports = {
    listCouponsController,
    createCouponController,
    getCouponDetailsController,
    updateCouponController,
    toggleCouponStatusController
};

