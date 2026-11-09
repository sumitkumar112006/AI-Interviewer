/**
 * aiUsage.model.js — Lightweight, Indexed AI Token and Cost Usage Collection
 *
 * Implements:
 * 1. Granular telemetry for every LLM and AI invocation across providers.
 * 2. Strict privacy: ZERO prompt, messages, or resume data stored.
 * 3. Separation of estimated cost vs actual billed cost.
 * 4. Idempotency key tracking to avoid duplicate records on retries.
 * 5. Optimized multi-field indexing for fast aggregation pipelines.
 */

'use strict';

const mongoose = require('mongoose');

const aiUsageSchema = new mongoose.Schema({
    // Provider identity (e.g. 'groq', 'gcp.gemini', 'openrouter')
    provider: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    // Model identifier (e.g. 'openai/gpt-oss-120b', 'gemini-2.5-flash')
    model: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    // Feature / operational domain (e.g. 'resume_generation', 'interview_report', 'ai_assistant', 'cover_letter', 'resume_rewrite')
    feature: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    // Optional associated user
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },

    // Request tracking identifier
    requestId: {
        type: String,
        trim: true,
        index: true,
        default: null
    },

    // Background job ID (if spawned from BullMQ aiQueue)
    jobId: {
        type: String,
        trim: true,
        index: true,
        sparse: true,
        default: null
    },

    // Attempt count (e.g. 1 on first try, 2 on retry)
    attempt: {
        type: Number,
        default: 1
    },

    // Token telemetry from actual provider metadata
    inputTokens: {
        type: Number,
        default: 0,
        min: 0
    },

    outputTokens: {
        type: Number,
        default: 0,
        min: 0
    },

    totalTokens: {
        type: Number,
        default: 0,
        min: 0
    },

    // True only when provider response contained actual token usage metadata
    tokenCountsAvailable: {
        type: Boolean,
        default: true
    },

    // Estimated cost based on centralized pricing (USD)
    estimatedCostUsd: {
        type: Number,
        default: 0,
        min: 0
    },

    // Actual billed cost from provider invoice/reconciliation (separate from estimated)
    actualBilledCostUsd: {
        type: Number,
        default: null
    },

    // Execution status
    status: {
        type: String,
        enum: ['success', 'failed'],
        default: 'success',
        index: true
    },

    // Sanitized error reason if failed (never contains prompt or personal content)
    errorMessage: {
        type: String,
        default: null,
        maxlength: 500
    },

    // Provider turnaround latency in milliseconds
    latencyMs: {
        type: Number,
        default: 0,
        min: 0
    },

    // Unique idempotency key to prevent duplicate records when jobs retry
    idempotencyKey: {
        type: String,
        unique: true,
        sparse: true
    },

    // Event timestamp
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: false,
    versionKey: false
});

// Compound indexes for rapid aggregation and dashboard filtering
aiUsageSchema.index({ timestamp: -1, provider: 1 });
aiUsageSchema.index({ feature: 1, timestamp: -1 });
aiUsageSchema.index({ userId: 1, timestamp: -1 });
aiUsageSchema.index({ status: 1, timestamp: -1 });
aiUsageSchema.index({ provider: 1, model: 1, timestamp: -1 });

const AiUsage = mongoose.models.AiUsage || mongoose.model('AiUsage', aiUsageSchema);

module.exports = AiUsage;

