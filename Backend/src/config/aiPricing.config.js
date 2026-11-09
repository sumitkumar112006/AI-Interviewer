/**
 * aiPricing.config.js — Centrally Maintainable AI Model Pricing Registry
 *
 * Implements:
 * 1. Single source of truth for LLM token pricing per provider & model.
 * 2. Rates defined as USD per 1,000,000 (1M) input and output tokens.
 * 3. Separate input and output token pricing.
 * 4. Safe helper to calculate estimated cost without hardcoding rates elsewhere.
 * 5. Handles unknown models gracefully with default fallback rates.
 */

'use strict';

/**
 * Model Pricing Registry
 * Format:
 *   inputPerMillion: USD per 1,000,000 input/prompt tokens
 *   outputPerMillion: USD per 1,000,000 output/completion tokens
 */
const MODEL_PRICING = Object.freeze({
    // ─── Groq Hosted Models ──────────────────────────────────────────────────
    'openai/gpt-oss-120b': {
        inputPerMillion: 0.50,
        outputPerMillion: 0.80,
        provider: 'groq'
    },
    'llama-3.3-70b-versatile': {
        inputPerMillion: 0.59,
        outputPerMillion: 0.79,
        provider: 'groq'
    },
    'llama-3.1-8b-instant': {
        inputPerMillion: 0.05,
        outputPerMillion: 0.08,
        provider: 'groq'
    },
    'mixtral-8x7b-32768': {
        inputPerMillion: 0.24,
        outputPerMillion: 0.24,
        provider: 'groq'
    },

    // ─── Google Gemini (GenAI SDK) ───────────────────────────────────────────
    'gemini-3.5-flash': {
        inputPerMillion: 0.10,
        outputPerMillion: 0.40,
        provider: 'gcp.gemini'
    },
    'gemini-2.5-flash': {
        inputPerMillion: 0.075,
        outputPerMillion: 0.30,
        provider: 'gcp.gemini'
    },
    'gemini-1.5-flash': {
        inputPerMillion: 0.075,
        outputPerMillion: 0.30,
        provider: 'gcp.gemini'
    },
    'gemini-1.5-pro': {
        inputPerMillion: 1.25,
        outputPerMillion: 5.00,
        provider: 'gcp.gemini'
    },
    'gemini-embedding-2': {
        inputPerMillion: 0.08,
        outputPerMillion: 0.0,
        provider: 'gcp.gemini'
    },
    'text-embedding-004': {
        inputPerMillion: 0.08,
        outputPerMillion: 0.0,
        provider: 'gcp.gemini'
    },

    // ─── OpenRouter Models ────────────────────────────────────────────────────
    'nvidia/nemotron-3-super-120b-a12b:free': {
        inputPerMillion: 0.0,
        outputPerMillion: 0.0,
        provider: 'openrouter'
    },
    'meta-llama/llama-3.3-70b-instruct:free': {
        inputPerMillion: 0.0,
        outputPerMillion: 0.0,
        provider: 'openrouter'
    },

    // ─── Default / Fallback Rates ─────────────────────────────────────────────
    'default': {
        inputPerMillion: 0.10,
        outputPerMillion: 0.30,
        provider: 'unknown'
    }
});

/**
 * Lookup pricing configuration for a given model identifier.
 * Matches model ID case-insensitively or falls back to default.
 *
 * @param {string} model
 * @returns {{ inputPerMillion: number, outputPerMillion: number, provider?: string }}
 */
function getModelPricing(model) {
    if (!model || typeof model !== 'string') {
        return MODEL_PRICING['default'];
    }

    const cleanModel = model.trim().toLowerCase();

    // Exact or direct key match
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
        if (key.toLowerCase() === cleanModel) {
            return pricing;
        }
    }

    // Partial match for version tags (e.g. gemini-1.5-flash-001 -> gemini-1.5-flash)
    for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
        if (key !== 'default' && cleanModel.startsWith(key.toLowerCase())) {
            return pricing;
        }
    }

    return MODEL_PRICING['default'];
}

/**
 * Calculates estimated USD cost based on token counts.
 * Keeps estimated cost separate from actual billed cost.
 *
 * @param {string} model - Model identifier
 * @param {number} inputTokens - Prompt / input tokens
 * @param {number} outputTokens - Completion / output tokens
 * @returns {number} Estimated cost in USD rounded to 6 decimal places
 */
function calculateEstimatedCost(model, inputTokens = 0, outputTokens = 0) {
    const validIn = typeof inputTokens === 'number' && !isNaN(inputTokens) && inputTokens > 0 ? inputTokens : 0;
    const validOut = typeof outputTokens === 'number' && !isNaN(outputTokens) && outputTokens > 0 ? outputTokens : 0;

    if (validIn === 0 && validOut === 0) {
        return 0;
    }

    const pricing = getModelPricing(model);
    const inputCost = (validIn / 1_000_000) * pricing.inputPerMillion;
    const outputCost = (validOut / 1_000_000) * pricing.outputPerMillion;

    const total = inputCost + outputCost;
    return Number(total.toFixed(6));
}

module.exports = {
    MODEL_PRICING,
    getModelPricing,
    calculateEstimatedCost
};

