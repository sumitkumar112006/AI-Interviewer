/**
 * @file embeddingService.js
 * @module services/ats/matchers/embeddingService
 *
 * Provides batch embedding generation using the configured embedding model with Redis caching.
 * Falls back gracefully to exact & canonical matching if embedding generation is unavailable.
 */

'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEYS } = require('../../../config/aiKeys.config');
const { ACTIVE_PROFILE } = require('../config/embedding.config');
const { getCache, setCache } = require('../../redis.service');
const crypto = require('crypto');

function getGenAiClient() {
    const validKeys = (GEMINI_API_KEYS || []).filter(
        k => typeof k === 'string' && k.trim().length > 0
    );
    if (!validKeys.length) return null;
    return new GoogleGenerativeAI(validKeys[0].trim());
}

/**
 * Embed a single text string with Redis caching.
 */
async function embedTextWithCache(text) {
    if (!text || typeof text !== 'string') return null;
    const cleanText = text.trim();
    if (!cleanText) return null;

    const hash = crypto.createHash('sha256').update(`${ACTIVE_PROFILE.model}:${cleanText}`).digest('hex');
    const cacheKey = `ats_emb:${hash}`;

    const cached = await getCache(cacheKey);
    if (cached && Array.isArray(cached)) {
        return cached;
    }

    const genai = getGenAiClient();
    if (!genai) return null;

    try {
        const model = genai.getGenerativeModel({ model: ACTIVE_PROFILE.model });
        const result = await model.embedContent(cleanText);
        const vector = result?.embedding?.values || null;
        if (vector) {
            await setCache(cacheKey, vector, 604800); // 7-day TTL
        }
        return vector;
    } catch (err) {
        console.warn(`[AtsEmbedder] Embedding notice for "${cleanText.slice(0, 30)}":`, err.message);
        return null;
    }
}

/**
 * Generate embedding vectors for an array of texts.
 */
async function embedBatch(texts = []) {
    const results = [];
    for (const item of texts) {
        const vec = await embedTextWithCache(item.text);
        if (vec) {
            results.push({ ...item, vector: vec });
        }
    }
    return results;
}

module.exports = {
    embedTextWithCache,
    embedBatch
};

