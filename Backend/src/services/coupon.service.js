/**
 * coupon.service.js — Complete Coupon Management & Discount Engine
 *
 * Implements:
 * 1. Admin CRUD: Create, update, list, and activate/deactivate coupons.
 * 2. Secure checkout validation and server-side discount calculation.
 * 3. Race condition prevention via atomic findOneAndUpdate operations.
 * 4. Immutable redemption tracking across order initiation, payment capture, and order failure.
 * 5. Full audit trail logging for administrative actions.
 */

'use strict';

const mongoose = require('mongoose');
const Coupon = require('../models/coupon.model');
const CouponRedemption = require('../models/couponRedemption.model');
const { calculateCouponDiscount } = require('./paymentLogic');
const auditLogService = require('./auditLog.service');
const systemEventModel = require('../models/systemEvent.model');

class CouponService {
    /**
     * Create a new coupon (Admin)
     */
    async createCoupon(data, context = {}) {
        const { actorId, actorUsername = 'admin', actorRole = 'admin', req } = context;

        if (!data.code || typeof data.code !== 'string') {
            throw { status: 400, message: 'Coupon code is required.' };
        }

        const normalizedCode = data.code.trim().toUpperCase();
        if (normalizedCode.length < 3 || normalizedCode.length > 30) {
            throw { status: 400, message: 'Coupon code must be between 3 and 30 characters.' };
        }

        // Check uniqueness
        const existing = await Coupon.findOne({ code: normalizedCode });
        if (existing) {
            throw { status: 400, message: `Coupon with code "${normalizedCode}" already exists.` };
        }

        const discountType = (data.discountType || 'PERCENTAGE').toUpperCase();
        if (!['PERCENTAGE', 'FIXED'].includes(discountType)) {
            throw { status: 400, message: 'Discount type must be either PERCENTAGE or FIXED.' };
        }

        const discountValue = Number(data.discountValue);
        if (!discountValue || discountValue <= 0) {
            throw { status: 400, message: 'Discount value must be a positive number.' };
        }

        if (discountType === 'PERCENTAGE' && discountValue > 100) {
            throw { status: 400, message: 'Percentage discount cannot exceed 100%.' };
        }

        // Validate dates if provided
        const startDate = data.startDate ? new Date(data.startDate) : new Date();
        const expirationDate = data.expirationDate ? new Date(data.expirationDate) : null;

        if (expirationDate && expirationDate.getTime() <= startDate.getTime()) {
            throw { status: 400, message: 'Expiration date must be after the start date.' };
        }

        // Validate limits
        const usageLimit = data.usageLimit !== undefined && data.usageLimit !== null && data.usageLimit !== ''
            ? Math.max(1, parseInt(data.usageLimit, 10))
            : null;

        const perUserLimit = data.perUserLimit !== undefined && data.perUserLimit !== null && data.perUserLimit !== ''
            ? Math.max(1, parseInt(data.perUserLimit, 10))
            : 1;

        const minOrderValue = data.minOrderValue ? Math.max(0, parseInt(data.minOrderValue, 10)) : 0;
        const maxDiscountAmount = data.maxDiscountAmount ? Math.max(0, parseInt(data.maxDiscountAmount, 10)) : null;

        let eligiblePlans = ['pro', 'premium'];
        if (Array.isArray(data.eligiblePlans) && data.eligiblePlans.length > 0) {
            eligiblePlans = data.eligiblePlans.map(p => String(p).trim().toLowerCase()).filter(p => ['pro', 'premium'].includes(p));
            if (eligiblePlans.length === 0) eligiblePlans = ['pro', 'premium'];
        }

        const coupon = new Coupon({
            code: normalizedCode,
            discountType,
            discountValue,
            maxDiscountAmount,
            minOrderValue,
            startDate,
            expirationDate,
            usageLimit,
            perUserLimit,
            eligiblePlans,
            isActive: data.isActive !== false,
            description: data.description ? String(data.description).trim() : '',
            createdBy: (actorId && mongoose.isValidObjectId(actorId)) ? actorId : null
        });

        await coupon.save();

        // Audit Trail
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'COUPON_CREATED',
                category: 'BILLING',
                severity: 'INFO',
                targetType: 'Coupon',
                targetIdentifier: normalizedCode,
                after: coupon.toObject(),
                changeSummary: `Admin "${actorUsername}" (${actorRole}) created coupon "${normalizedCode}" (${discountType === 'PERCENTAGE' ? `${discountValue}%` : `₹${(discountValue / 100).toFixed(2)}`} off)`
            });

            await systemEventModel.recordOperationalEvent({
                eventType: 'COUPON_CREATED',
                category: 'BILLING',
                severity: 'INFO',
                message: `New coupon code created: ${normalizedCode}`,
                metadata: { couponCode: normalizedCode, discountType, discountValue }
            });
        } catch (err) {
            console.warn('[COUPON_SERVICE] Non-fatal audit log warning:', err.message);
        }

        return coupon;
    }

    /**
     * Update an existing coupon (Admin)
     */
    async updateCoupon(couponId, updates, context = {}) {
        const { actorId, actorUsername = 'admin', actorRole = 'admin', req } = context;

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            throw { status: 404, message: 'Coupon not found.' };
        }

        const beforeState = coupon.toObject();

        if (updates.description !== undefined) {
            coupon.description = String(updates.description).trim();
        }

        if (updates.isActive !== undefined) {
            coupon.isActive = Boolean(updates.isActive);
        }

        if (updates.expirationDate !== undefined) {
            coupon.expirationDate = updates.expirationDate ? new Date(updates.expirationDate) : null;
            if (coupon.expirationDate && coupon.expirationDate.getTime() <= new Date(coupon.startDate).getTime()) {
                throw { status: 400, message: 'Expiration date must be after the start date.' };
            }
        }

        if (updates.usageLimit !== undefined) {
            coupon.usageLimit = updates.usageLimit !== null && updates.usageLimit !== ''
                ? Math.max(1, parseInt(updates.usageLimit, 10))
                : null;
        }

        if (updates.perUserLimit !== undefined) {
            coupon.perUserLimit = Math.max(1, parseInt(updates.perUserLimit, 10) || 1);
        }

        if (updates.minOrderValue !== undefined) {
            coupon.minOrderValue = Math.max(0, parseInt(updates.minOrderValue, 10) || 0);
        }

        if (updates.maxDiscountAmount !== undefined) {
            coupon.maxDiscountAmount = updates.maxDiscountAmount !== null && updates.maxDiscountAmount !== ''
                ? Math.max(0, parseInt(updates.maxDiscountAmount, 10))
                : null;
        }

        if (Array.isArray(updates.eligiblePlans)) {
            const plans = updates.eligiblePlans.map(p => String(p).trim().toLowerCase()).filter(p => ['pro', 'premium'].includes(p));
            if (plans.length > 0) {
                coupon.eligiblePlans = plans;
            }
        }

        await coupon.save();

        // Audit Trail
        try {
            await auditLogService.recordAdminAudit({
                req,
                action: 'COUPON_UPDATED',
                category: 'BILLING',
                severity: 'INFO',
                targetType: 'Coupon',
                targetIdentifier: coupon.code,
                before: beforeState,
                after: coupon.toObject(),
                changeSummary: `Admin "${actorUsername}" (${actorRole}) updated coupon "${coupon.code}"`
            });
        } catch (err) {
            console.warn('[COUPON_SERVICE] Non-fatal audit log warning:', err.message);
        }

        return coupon;
    }

    /**
     * Activate or Deactivate a coupon (Admin)
     */
    async toggleCouponStatus(couponId, isActive, context = {}) {
        const { actorId, actorUsername = 'admin', actorRole = 'admin', req } = context;

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            throw { status: 404, message: 'Coupon not found.' };
        }

        const oldStatus = coupon.isActive;
        coupon.isActive = Boolean(isActive);
        await coupon.save();

        try {
            await auditLogService.recordAdminAudit({
                req,
                action: coupon.isActive ? 'COUPON_ACTIVATED' : 'COUPON_DEACTIVATED',
                category: 'BILLING',
                severity: 'INFO',
                targetType: 'Coupon',
                targetIdentifier: coupon.code,
                before: { isActive: oldStatus },
                after: { isActive: coupon.isActive },
                changeSummary: `Admin "${actorUsername}" ${coupon.isActive ? 'activated' : 'deactivated'} coupon "${coupon.code}"`
            });
        } catch (err) {
            console.warn('[COUPON_SERVICE] Non-fatal audit log warning:', err.message);
        }

        return coupon;
    }

    /**
     * List coupons with pagination, usage statistics, and status filters (Admin)
     */
    async listCoupons(query = {}) {
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 15));
        const skip = (page - 1) * limit;

        const filter = {};

        // Search query filter (matches code or description)
        if (query.search && query.search.trim()) {
            const regex = new RegExp(query.search.trim(), 'i');
            filter.$or = [{ code: regex }, { description: regex }];
        }

        // Status filter
        const now = new Date();
        if (query.status === 'active') {
            filter.isActive = true;
            filter.$and = [
                { $or: [{ expirationDate: null }, { expirationDate: { $gt: now } }] },
                { startDate: { $lte: now } }
            ];
        } else if (query.status === 'inactive') {
            filter.isActive = false;
        } else if (query.status === 'expired') {
            filter.expirationDate = { $lte: now };
        }

        const [coupons, total] = await Promise.all([
            Coupon.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('createdBy', 'username email')
                .lean(),
            Coupon.countDocuments(filter)
        ]);

        // Aggregate high-level platform coupon stats
        const [statsAgg] = await Coupon.aggregate([
            {
                $group: {
                    _id: null,
                    totalCoupons: { $sum: 1 },
                    activeCoupons: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$isActive', true] },
                                        { $or: [{ $eq: ['$expirationDate', null] }, { $gt: ['$expirationDate', now] }] },
                                        { $lte: ['$startDate', now] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },
                    totalRedemptions: { $sum: '$usedCount' }
                }
            }
        ]);

        // Total monetary savings given to users
        const [redemptionSavings] = await CouponRedemption.aggregate([
            { $match: { status: 'APPLIED' } },
            { $group: { _id: null, totalSavings: { $sum: '$discountAmount' } } }
        ]);

        return {
            coupons,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1
            },
            stats: {
                totalCoupons: statsAgg?.totalCoupons || 0,
                activeCoupons: statsAgg?.activeCoupons || 0,
                totalRedemptions: statsAgg?.totalRedemptions || 0,
                totalDiscountSaved: redemptionSavings?.totalSavings || 0
            }
        };
    }

    /**
     * Get single coupon details and recent redemptions (Admin)
     */
    async getCouponDetails(couponId) {
        const coupon = await Coupon.findById(couponId).populate('createdBy', 'username email');
        if (!coupon) {
            throw { status: 404, message: 'Coupon not found.' };
        }

        const redemptions = await CouponRedemption.find({ couponId: coupon._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('userId', 'username email')
            .populate('orderId', 'amount status billingCycle')
            .lean();

        return {
            coupon,
            redemptions
        };
    }

    /**
     * Validate a coupon code for checkout (Public/User)
     * Performs complete server-side verification:
     * - Existence & Active state
     * - Time window (Start vs Expiration)
     * - Plan eligibility
     * - Minimum order value
     * - Global usage limit
     * - Per-user usage limit
     * - Deterministic discount computation
     */
    async validateCouponForCheckout({ code, userId, planKey, orderAmount }) {
        if (!code || typeof code !== 'string') {
            throw { status: 400, message: 'Please provide a coupon code.' };
        }

        const normalizedCode = code.trim().toUpperCase();
        const coupon = await Coupon.findOne({ code: normalizedCode });

        if (!coupon) {
            throw { status: 404, message: `Coupon code "${normalizedCode}" does not exist.` };
        }

        if (!coupon.isActive) {
            throw { status: 400, message: 'This coupon is currently inactive.' };
        }

        const now = Date.now();
        if (coupon.startDate && new Date(coupon.startDate).getTime() > now) {
            throw { status: 400, message: 'This promotional coupon has not started yet.' };
        }

        if (coupon.expirationDate && new Date(coupon.expirationDate).getTime() < now) {
            throw { status: 400, message: 'This promotional coupon has expired.' };
        }

        // Validate plan eligibility
        const normalizedPlan = (planKey || '').trim().toLowerCase();
        if (Array.isArray(coupon.eligiblePlans) && coupon.eligiblePlans.length > 0) {
            const isEligible = coupon.eligiblePlans.some(p => p.toLowerCase() === normalizedPlan);
            if (!isEligible) {
                throw {
                    status: 400,
                    message: `Coupon "${normalizedCode}" is not applicable to the ${normalizedPlan.toUpperCase()} plan.`
                };
            }
        }

        // Validate minimum order value
        if (coupon.minOrderValue && orderAmount < coupon.minOrderValue) {
            const minRupees = (coupon.minOrderValue / 100).toFixed(2);
            throw {
                status: 400,
                message: `Minimum order value of ₹${minRupees} required to use coupon "${normalizedCode}".`
            };
        }

        // Validate global total usage limit
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            throw {
                status: 400,
                message: `Coupon "${normalizedCode}" has reached its maximum total usage limit.`
            };
        }

        // Validate per-user usage limit
        if (userId && coupon.perUserLimit) {
            const userRedemptions = await CouponRedemption.countDocuments({
                couponId: coupon._id,
                userId,
                status: { $in: ['APPLIED', 'PENDING'] }
            });

            if (userRedemptions >= coupon.perUserLimit) {
                throw {
                    status: 400,
                    message: `You have already redeemed coupon "${normalizedCode}" the maximum allowed number of times (${coupon.perUserLimit}x).`
                };
            }
        }

        // Calculate discount purely server-side
        const discountCalc = calculateCouponDiscount(coupon, orderAmount, normalizedPlan);

        return {
            valid: true,
            couponId: coupon._id,
            couponCode: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: discountCalc.discountAmount,
            finalAmount: discountCalc.finalAmount,
            originalAmount: discountCalc.originalAmount,
            savingsFormatted: `₹${(discountCalc.discountAmount / 100).toFixed(2)}`
        };
    }

    /**
     * Atomically apply a coupon to a pending payment order during checkout.
     * Prevents race conditions using MongoDB atomic operators ($inc, conditional updates).
     */
    async applyCouponToOrder({ order, couponCode, userId, session = null }) {
        if (!couponCode) return order;

        const validation = await this.validateCouponForCheckout({
            code: couponCode,
            userId,
            planKey: order.planKey,
            orderAmount: order.originalAmount || order.amount
        });

        // 1. Atomically increment usedCount guarded by usageLimit
        const query = {
            _id: validation.couponId,
            isActive: true
        };

        const couponDoc = await Coupon.findById(validation.couponId);
        if (couponDoc.usageLimit) {
            query.usedCount = { $lt: couponDoc.usageLimit };
        }

        const updateOptions = { new: true, returnDocument: 'after' };
        if (session) updateOptions.session = session;

        const updatedCoupon = await Coupon.findOneAndUpdate(
            query,
            { $inc: { usedCount: 1 } },
            updateOptions
        );

        if (!updatedCoupon) {
            throw {
                status: 400,
                message: 'Coupon usage limit was reached just now. Please try without coupon.'
            };
        }

        // 2. Create CouponRedemption ledger entry
        const redemptionData = {
            couponId: validation.couponId,
            couponCode: validation.couponCode,
            userId,
            orderId: order._id,
            originalAmount: validation.originalAmount,
            discountAmount: validation.discountAmount,
            finalAmount: validation.finalAmount,
            status: 'PENDING'
        };

        const redemption = new CouponRedemption(redemptionData);
        await redemption.save({ session });

        // 3. Update order fields
        order.couponCode = validation.couponCode;
        order.couponId = validation.couponId;
        order.originalAmount = validation.originalAmount;
        order.discountAmount = validation.discountAmount;
        order.amount = validation.finalAmount;

        return order;
    }

    /**
     * Finalize coupon redemption when payment is captured/verified.
     */
    async finalizeCouponRedemption({ orderId, paymentId, session = null }) {
        const query = { orderId };
        const update = {
            $set: {
                status: 'APPLIED',
                paymentId,
                redeemedAt: new Date()
            }
        };
        const options = { new: true, returnDocument: 'after' };
        if (session) options.session = session;

        return await CouponRedemption.findOneAndUpdate(query, update, options);
    }

    /**
     * Release coupon reservation if an order expires, cancels, or fails gateway creation.
     */
    async releaseCouponOnFailure({ orderId }) {
        const redemption = await CouponRedemption.findOne({ orderId, status: 'PENDING' });
        if (!redemption) return;

        redemption.status = 'FAILED';
        await redemption.save();

        // Atomically decrement usedCount back
        await Coupon.updateOne(
            { _id: redemption.couponId, usedCount: { $gt: 0 } },
            { $inc: { usedCount: -1 } }
        );
    }
}

module.exports = new CouponService();

