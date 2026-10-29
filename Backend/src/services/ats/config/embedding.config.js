/**
 * @file embedding.config.js
 * @module services/ats/config/embedding.config
 *
 * Configurable Embedding Profiles.
 * Decouples model provider and calibrates cosine similarity thresholds per model family.
 */

'use strict';

const EMBEDDING_PROFILES = {
    // Google Gemini default embedding model
    'gemini-default': {
        provider: 'gemini',
        model: process.env.EMBEDDING_MODEL || 'gemini-embedding-2',
        thresholds: {
            STRONG_MATCH: 0.82,
            PARTIAL_MATCH: 0.65,
            WEAK_MATCH: 0.50
        }
    },
    'gemini-text-004': {
        provider: 'gemini',
        model: 'text-embedding-004',
        thresholds: {
            STRONG_MATCH: 0.80,
            PARTIAL_MATCH: 0.62,
            WEAK_MATCH: 0.48
        }
    },
    'openai-3-small': {
        provider: 'openai',
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        thresholds: {
            STRONG_MATCH: 0.78,
            PARTIAL_MATCH: 0.60,
            WEAK_MATCH: 0.45
        }
    }
};

const ACTIVE_PROFILE_KEY = process.env.EMBEDDING_PROFILE || 'gemini-default';
const ACTIVE_PROFILE = EMBEDDING_PROFILES[ACTIVE_PROFILE_KEY] || EMBEDDING_PROFILES['gemini-default'];

module.exports = {
    ACTIVE_PROFILE,
    EMBEDDING_PROFILES
};

