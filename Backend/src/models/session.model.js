/**
 * session.model.js — Active Session & Device Tracking Model
 *
 * Requirements:
 * - Session ID (safe unique identifier, e.g. sess_<uuid>)
 * - User ID (ref: 'user')
 * - Token hash (SHA-256 hash of JWT — NEVER raw JWT)
 * - Browser, OS, deviceType, userAgent
 * - IP address
 * - Status: ACTIVE, REVOKED, EXPIRED
 * - Timestamps: createdAt, updatedAt, lastActiveAt, revokedAt, expiresAt
 * - Revocation details: revokedBy, revocationReason
 */

'use strict';

const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        index: true
    },
    tokenHash: {
        type: String,
        required: true,
        index: true
    },
    browser: {
        type: String,
        default: 'Unknown Browser'
    },
    deviceType: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet', 'unknown'],
        default: 'unknown'
    },
    os: {
        type: String,
        default: 'Unknown OS'
    },
    userAgent: {
        type: String,
        default: ''
    },
    ipAddress: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
        default: 'ACTIVE',
        index: true
    },
    revokedAt: {
        type: Date,
        default: null
    },
    revokedBy: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    revocationReason: {
        type: String,
        default: null
    },
    lastActiveAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // TTL index for automatic MongoDB expiration
    }
}, {
    timestamps: true
});

sessionSchema.index({ userId: 1, status: 1 });
sessionSchema.index({ sessionId: 1, status: 1 });
sessionSchema.index({ userId: 1, lastActiveAt: -1 });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;

