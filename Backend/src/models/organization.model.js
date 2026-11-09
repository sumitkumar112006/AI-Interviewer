/**
 * organization.model.js — B2B Partner & Organization Management Model
 *
 * Implements:
 * 1. College, placement cell, recruiter, and corporate partner entities.
 * 2. Organization admin assignment and ownership.
 * 3. Agreement / subscription details (seat limits, quotas, validity period).
 * 4. Aggregate usage stats and settings.
 */

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const organizationSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Organization name is required.'],
        trim: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true,
        index: true
    },
    type: {
        type: String,
        enum: ['college', 'placement_cell', 'recruiter', 'corporate_partner', 'other'],
        required: true,
        default: 'college',
        index: true
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'pending'],
        default: 'active',
        index: true
    },
    contact: {
        contactPerson: { type: String, default: '', trim: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        phone: { type: String, default: '', trim: true },
        website: { type: String, default: '', trim: true },
        address: { type: String, default: '', trim: true }
    },
    adminOwner: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        default: null
    },
    orgAdmins: [{
        type: Schema.Types.ObjectId,
        ref: 'user'
    }],
    agreement: {
        contractId: { type: String, default: '', trim: true },
        tier: { type: String, enum: ['starter', 'standard', 'enterprise'], default: 'standard' },
        validFrom: { type: Date, default: Date.now },
        validUntil: { type: Date, default: null },
        maxSeats: { type: Number, default: 50, min: 1 },
        monthlyInterviewQuota: { type: Number, default: 500, min: 0 },
        monthlyResumeQuota: { type: Number, default: 500, min: 0 }
    },
    settings: {
        allowedEmailDomains: { type: [String], default: [] },
        autoJoinByDomain: { type: Boolean, default: false },
        allowCandidateExports: { type: Boolean, default: true }
    },
    stats: {
        totalMembers: { type: Number, default: 0 },
        totalInterviewsGenerated: { type: Number, default: 0 },
        totalResumesGenerated: { type: Number, default: 0 },
        totalCoverLettersGenerated: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

organizationSchema.index({ status: 1, type: 1 });
organizationSchema.index({ 'agreement.validUntil': 1 });

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization;

