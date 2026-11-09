/**
 * coupon.model.js — Centralized Coupon & Discount Management Model
 *
 * Implements:
 * 1. Fixed or percentage discount rules with optional maximum discount caps.
 * 2. Start and expiration dates, minimum order values, and plan eligibility.
 * 3. Total and per-user usage limits.
 * 4. Active/inactive state management.
 */

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        index: true,
        minlength: 3,
        maxlength: 30
    },
    discountType: {
        type: String,
        enum: ['PERCENTAGE', 'FIXED'],
        required: true,
        default: 'PERCENTAGE'
    },
    // For PERCENTAGE: 1 to 100
    // For FIXED: minor currency units (paise, e.g. 5000 = ₹50.00)
    discountValue: {
        type: Number,
        required: true,
        min: 1
    },
    // Optional cap for percentage discounts (in paise, e.g. 10000 = ₹100.00)
    maxDiscountAmount: {
        type: Number,
        default: null,
        min: 0
    },
    // Minimum order value in paise (e.g. 19900 = ₹199.00)
    minOrderValue: {
        type: Number,
        default: 0,
        min: 0
    },
    startDate: {
        type: Date,
        default: Date.now,
        index: true
    },
    expirationDate: {
        type: Date,
        default: null,
        index: true
    },
    // Maximum total redemptions across all users (null = unlimited)
    usageLimit: {
        type: Number,
        default: null,
        min: 1
    },
    // Total completed redemptions
    usedCount: {
        type: Number,
        default: 0,
        min: 0
    },
    // Maximum times a single user can redeem this coupon
    perUserLimit: {
        type: Number,
        default: 1,
        min: 1
    },
    eligiblePlans: {
        type: [String],
        default: ['pro', 'premium']
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: 300,
        default: ''
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        default: null
    }
}, {
    timestamps: true
});

// Virtual helper to check if coupon is currently expired
couponSchema.virtual('isExpired').get(function () {
    if (!this.expirationDate) return false;
    return new Date(this.expirationDate).getTime() < Date.now();
});

// Virtual helper to check if coupon has reached total usage limit
couponSchema.virtual('isExhausted').get(function () {
    if (!this.usageLimit) return false;
    return this.usedCount >= this.usageLimit;
});

couponSchema.set('toJSON', { virtuals: true });
couponSchema.set('toObject', { virtuals: true });

const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);

module.exports = Coupon;

