/**
 * @file requirementMatcher.js
 * @module services/ats/matchers/requirementMatcher
 *
 * Implements decoupled Requirement Resolution:
 * Exact -> Canonical -> Semantic (Embedding Cosine) with Anti-Double-Counting and Context Tiering.
 */

'use strict';

const { CANONICAL_ALIASES, COLLISION_BLOCKS } = require('../config/aliases.config');
const { ACTIVE_PROFILE } = require('../config/embedding.config');

const CONTEXT_TIERS = {
    PROFESSIONAL_EXP: 1.0,
    INTERNSHIP: 0.85,
    PROJECT: 0.75,
    CERTIFICATION: 0.60,
    SKILL_LIST: 0.40,
    SUMMARY: 0.35
};

/**
 * Computes cosine similarity between two float vectors.
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || !Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
        return 0;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Resolves a token to its normalized canonical form.
 */
function toCanonical(token) {
    if (!token || typeof token !== 'string') return '';
    const clean = token.toLowerCase().trim().replace(/[^a-z0-9#+.]/g, '');
    return CANONICAL_ALIASES[clean] || clean;
}

/**
 * Match a single JD requirement against resume evidence items.
 *
 * @param {Object} requirement - { id, name, category, isMandatory, criticality, aliases }
 * @param {Array<Object>} resumeEvidences - Array of { name, rawText, section, contextTier }
 * @param {Array<number>|null} reqEmbedding - Precomputed embedding vector for requirement
 * @param {Array<Object>|null} evidenceVectors - Array of { name, section, vector }
 * @returns {Object} Resolution result
 */
function matchSingleRequirement(requirement, resumeEvidences = [], reqEmbedding = null, evidenceVectors = []) {
    const reqCanonical = toCanonical(requirement.name);
    const blockedTokens = COLLISION_BLOCKS[reqCanonical] || [];

    // Filter candidate items that violate collision safety
    const candidatePool = resumeEvidences.filter(ev => {
        const evCanonical = toCanonical(ev.name);
        return !blockedTokens.includes(evCanonical);
    });

    // 1. EXACT / CANONICAL MATCHING
    const directMatches = candidatePool.filter(ev => {
        const evCanonical = toCanonical(ev.name);
        if (evCanonical === reqCanonical) return true;
        if (requirement.aliases && Array.isArray(requirement.aliases)) {
            return requirement.aliases.some(alias => toCanonical(alias) === evCanonical);
        }
        return false;
    });

    if (directMatches.length > 0) {
        // ANTI-DOUBLE-COUNTING: Take the highest context tier across all appearances
        const maxContextWeight = Math.max(...directMatches.map(m => CONTEXT_TIERS[m.contextTier] || 0.40));
        
        return {
            requirementId: requirement.id,
            requirementName: requirement.name,
            matchType: 'FULL_MATCH',
            matchConfidence: 1.0,
            contextWeight: maxContextWeight,
            score: 1.0 * maxContextWeight,
            matchedVia: 'EXACT_CANONICAL',
            occurrences: directMatches.length
        };
    }

    // 2. SEMANTIC EMBEDDING MATCHING (If embeddings provided)
    if (reqEmbedding && evidenceVectors && evidenceVectors.length > 0) {
        let bestSimilarity = 0;
        let bestEvidence = null;

        for (const evVec of evidenceVectors) {
            const evCanonical = toCanonical(evVec.name);
            if (blockedTokens.includes(evCanonical)) continue;

            const sim = cosineSimilarity(reqEmbedding, evVec.vector);
            if (sim > bestSimilarity) {
                bestSimilarity = sim;
                bestEvidence = evVec;
            }
        }

        const { thresholds } = ACTIVE_PROFILE;

        if (bestSimilarity >= thresholds.STRONG_MATCH) {
            const contextWeight = CONTEXT_TIERS[bestEvidence?.contextTier] || 0.40;
            return {
                requirementId: requirement.id,
                requirementName: requirement.name,
                matchType: 'STRONG_SEMANTIC_MATCH',
                matchConfidence: Number(bestSimilarity.toFixed(2)),
                contextWeight,
                score: 0.85 * contextWeight,
                matchedVia: 'SEMANTIC_STRONG',
                matchedWith: bestEvidence?.name
            };
        }

        if (bestSimilarity >= thresholds.PARTIAL_MATCH) {
            const contextWeight = CONTEXT_TIERS[bestEvidence?.contextTier] || 0.40;
            return {
                requirementId: requirement.id,
                requirementName: requirement.name,
                matchType: 'PARTIAL_MATCH',
                matchConfidence: Number(bestSimilarity.toFixed(2)),
                contextWeight,
                score: 0.50 * contextWeight,
                matchedVia: 'SEMANTIC_PARTIAL',
                matchedWith: bestEvidence?.name
            };
        }

        if (bestSimilarity >= thresholds.WEAK_MATCH) {
            const contextWeight = CONTEXT_TIERS[bestEvidence?.contextTier] || 0.40;
            return {
                requirementId: requirement.id,
                requirementName: requirement.name,
                matchType: 'WEAK_MATCH',
                matchConfidence: Number(bestSimilarity.toFixed(2)),
                contextWeight,
                score: 0.20 * contextWeight,
                matchedVia: 'SEMANTIC_WEAK',
                matchedWith: bestEvidence?.name
            };
        }
    }

    // 3. NO MATCH FOUND
    return {
        requirementId: requirement.id,
        requirementName: requirement.name,
        matchType: 'MISSING',
        matchConfidence: 1.0,
        contextWeight: 0,
        score: 0.0,
        matchedVia: 'NONE'
    };
}

module.exports = {
    matchSingleRequirement,
    cosineSimilarity,
    toCanonical,
    CONTEXT_TIERS
};

