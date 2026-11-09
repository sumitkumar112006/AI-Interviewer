/**
 * moderation.model.js — Content Moderation Record Model
 *
 * Implements:
 * 1. Persistent queue records for user-generated content violations and flags.
 * 2. Categories: spam, harassment, prompt_injection, policy_violation, repeated_abuse.
 * 3. Minimal sanitized snippet storage (<= 500 chars) & cryptographic content hash.
 * 4. Administrator review, action audit trail, and user appeals workflow.
 */

'use strict';

const mongoose = require('mongoose');

const moderationRecordSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        index: true,
        default: null
    },
    contentType: {
        type: String,
        enum: [
            'interview_request',
            'cover_letter',
            'assistant_message',
            'support_ticket',
            'resume_edit',
            'user_profile',
            'other'
        ],
        default: 'other',
        index: true
    },
    contentId: {
        type: String,
        default: null,
        index: true
    },
    category: {
        type: String,
        enum: [
            'spam',
            'harassment',
            'prompt_injection',
            'policy_violation',
            'repeated_abuse',
            'other'
        ],
        required: true,
        index: true
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true,
        index: true
    },
    flaggedBy: {
        type: String,
        enum: ['automated_rule', 'ai_screen', 'admin_flag', 'user_report'],
        default: 'automated_rule'
    },
    matchedRule: {
        type: String,
        required: true
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: 1.0
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'dismissed', 'escalated', 'action_taken'],
        default: 'pending',
        index: true
    },
    contentSnippet: {
        type: String,
        default: '',
        maxlength: 500
    },
    contentHash: {
        type: String,
        default: null,
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    adminDecision: {
        reviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            default: null
        },
        decision: {
            type: String,
            enum: ['dismiss', 'warn_user', 'restrict_feature', 'suspend_user', 'escalate', null],
            default: null
        },
        notes: {
            type: String,
            default: '',
            maxlength: 1000
        },
        actionDetails: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        decidedAt: {
            type: Date,
            default: null
        }
    },
    appeal: {
        status: {
            type: String,
            enum: ['none', 'submitted', 'approved', 'rejected'],
            default: 'none',
            index: true
        },
        reason: {
            type: String,
            default: '',
            maxlength: 1000
        },
        submittedAt: {
            type: Date,
            default: null
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users',
            default: null
        },
        reviewerNotes: {
            type: String,
            default: '',
            maxlength: 1000
        },
        reviewedAt: {
            type: Date,
            default: null
        }
    }
}, {
    timestamps: true
});

// Compound indexes for fast admin queue filtering and deduplication
moderationRecordSchema.index({ status: 1, createdAt: -1 });
moderationRecordSchema.index({ category: 1, severity: 1 });
moderationRecordSchema.index({ user: 1, createdAt: -1 });
moderationRecordSchema.index({ contentHash: 1, createdAt: -1 });

module.exports = mongoose.model('ModerationRecord', moderationRecordSchema);

