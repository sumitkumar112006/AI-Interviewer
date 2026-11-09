/**
 * couponRedemption.model.js — Immutable Coupon Redemption Ledger
 *
 * Implements:
 * 1. Persistent audit trail for every applied coupon.
 * 2. Race-condition prevention via compound unique indexes.
 * 3. Lifecycle tracking from order creation (PENDING) through payment capture (APPLIED).
 */

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponRedemptionSchema = new Schema({
    couponId: {
        type: Schema.Types.ObjectId,
        ref: 'Coupon',
        required: true,
        index: true
    },
    couponCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        index: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        index: true
    },
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'PaymentOrder',
        required: true,
        index: true
    },
    paymentId: {
        type: Schema.Types.ObjectId,
        ref: 'Payment',
        default: null,
        index: true
    },
    originalAmount: {
        type: Number,
        required: true
    },
    discountAmount: {
        type: Number,
        required: true
    },
    finalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'APPLIED', 'FAILED', 'REFUNDED'],
        default: 'PENDING',
        index: true
    },
    redeemedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Prevent duplicate coupon redemptions on the same order
couponRedemptionSchema.index({ couponId: 1, orderId: 1 }, { unique: true });

// Compound index for ultra-fast per-user usage checks
couponRedemptionSchema.index({ couponId: 1, userId: 1, status: 1 });

const CouponRedemption = mongoose.models.CouponRedemption || mongoose.model('CouponRedemption', couponRedemptionSchema);

module.exports = CouponRedemption;

