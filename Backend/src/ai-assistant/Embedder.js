/**
 * @file Embedder.js
 * @module ai-assistant/Embedder
 *
 * RESPONSIBILITY:
 *   Accept the resumeChunks[] array (produced by Chunker.js) and attach an
 *   embedding vector to each chunk. Also provides a utility to embed a raw
 *   query string for similarity search.
 *
 * EMBEDDING MODEL:
 *   - Primary  : Google "gemini-embedding-2" via @google/generative-ai SDK
 *   - Fallback : Not needed — Gemini quota is pooled via GEMINI_API_KEYS.
 *
 * WHAT GETS EMBEDDED:
 *   Each chunk's `text` field is prefixed with its type + section for richer
 *   context before embedding, e.g.:
 *     "experience bullet: Built REST APIs serving 1M req/day"
 *     "projects proj_header: ResumeAI | Next.js, Node.js, MongoDB"
 *
 * CACHING:
 *   Enriched chunks[] (with embedding vectors) are cached in Redis under key
 *   `resume_chunks:<reportId>` with a 30-minute TTL.
 *
 * VECTOR DIMENSIONS:
 *   gemini-embedding-2 outputs 3072-dimensional float vectors stored as
 *   a plain JS number[] array (JSON-serializable for Redis).
 *
 * MODEL SELECTION NOTE:
 *   text-embedding-004 requires elevated API access not available on free-tier
 *   Gemini keys. gemini-embedding-2 is the highest-quality model available on
 *   standard keys and outperforms text-embedding-004 on semantic retrieval tasks.
 */

'use strict';

require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getCache, setCache, deleteCache } = require('../services/redis.service');
const { GEMINI_API_KEYS } = require('../config/aiKeys.config');

// ─── Constants ────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL    = 'gemini-embedding-2';
const CACHE_TTL_SECONDS  = 1800; // 30 minutes
const CACHE_KEY_PREFIX   = 'resume_chunks';
const BATCH_SIZE         = 20;   // max embeddings per API call (stay under rate limits)

// ─── Gemini client pool (round-robin across keys) ─────────────────────────────

/** Pick the first valid Gemini API key available. */
function getGeminiClient() {
    const validKeys = (GEMINI_API_KEYS || []).filter(
        k => typeof k === 'string' && k.trim().length > 0
    );
    if (!validKeys.length) {
        throw new Error('[Embedder] No valid GEMINI_API_KEY found in environment');
    }
    // Primary key only for embeddings (not a hot path — cached after first call)
    return new GoogleGenerativeAI(validKeys[0].trim());
}

// ─── Text preparation ─────────────────────────────────────────────────────────

/**
 * Build the embedding input string for a chunk.
 * Prefixing with type+section improves retrieval accuracy across sections.
 *
 * @param {object} chunk
 * @returns {string}
 */
function buildEmbedInput(chunk) {
    const prefix = `${chunk.section} ${chunk.type}`;
    return `${prefix}: ${chunk.text}`.trim();
}

// ─── Core embedding functions ─────────────────────────────────────────────────

/**
 * Embed a single text string and return the embedding vector as number[].
 *
 * @param {GoogleGenerativeAI} genai
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(genai, text) {
    const model  = genai.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

/**
 * Embed an array of chunks in batches to stay within API rate limits.
 * Attaches `embedding: number[]` to each chunk in-place and returns the
 * enriched array.
 *
 * @param {object[]} chunks  - Raw chunks from parseResumeHtml()
 * @returns {Promise<object[]>}  - Same chunks with .embedding field added
 */
async function embedChunks(chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
        console.warn('[Embedder] embedChunks called with empty chunks array');
        return [];
    }

    console.log(`[Embedder] 🚀 Starting embedding for ${chunks.length} chunks (model: ${EMBEDDING_MODEL})`);

    const genai      = getGeminiClient();
    const enriched   = [];
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const batchStart = batchIdx * BATCH_SIZE;
        const batch      = chunks.slice(batchStart, batchStart + BATCH_SIZE);

        console.log(`[Embedder] 📦 Embedding batch ${batchIdx + 1}/${totalBatches} (${batch.length} chunks)`);

        // Embed all items in this batch concurrently
        const embedPromises = batch.map(chunk => {
            const input = buildEmbedInput(chunk);
            return embedText(genai, input)
                .then(vector => ({ ...chunk, embedding: vector }))
                .catch(err => {
                    console.error(`[Embedder] ❌ Failed to embed chunk ${chunk.id} (${chunk.type}):`, err.message);
                    return { ...chunk, embedding: null }; // keep chunk, mark embedding as failed
                });
        });

        const batchResults = await Promise.all(embedPromises);
        enriched.push(...batchResults);

        // Small back-off between batches to be friendly to rate limits
        if (batchIdx < totalBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    const successCount = enriched.filter(c => c.embedding !== null).length;
    const failCount    = enriched.length - successCount;

    console.log(`[Embedder] ✅ Embedding complete — ${successCount} succeeded, ${failCount} failed`);

    // Log a compact summary of each embedded chunk (vector truncated to first 5 dims)
    console.log(`[Embedder] 📊 Embedding results:`, JSON.stringify(
        enriched.map(c => ({
            id        : c.id,
            type      : c.type,
            section   : c.section,
            wordCount : c.wordCount,
            text      : c.text.slice(0, 60) + (c.text.length > 60 ? '…' : ''),
            embedding : c.embedding
                ? `[${c.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, …] (${c.embedding.length} dims)`
                : 'FAILED',
        })),
        null, 2
    ));

    return enriched;
}

/**
 * Embed a raw query string for use in similarity search.
 *
 * @param {string} queryText
 * @returns {Promise<number[]>}
 */
async function embedQuery(queryText) {
    if (!queryText || typeof queryText !== 'string') {
        throw new Error('[Embedder] embedQuery requires a non-empty string');
    }

    console.log(`[Embedder] 🔍 Embedding query: "${queryText.slice(0, 80)}…"`);

    const genai   = getGeminiClient();
    const vector  = await embedText(genai, queryText.trim());

    console.log(`[Embedder] ✅ Query embedded — vector dims: ${vector.length}, preview: [${vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, …]`);

    return vector;
}

// ─── Redis caching ────────────────────────────────────────────────────────────

/**
 * Retrieve cached enriched chunks from Redis.
 *
 * @param {string} reportId
 * @returns {Promise<object[]|null>}  - Enriched chunks[] or null if cache miss
 */
async function getCachedChunks(reportId) {
    if (!reportId) return null;
    const key = `${CACHE_KEY_PREFIX}:${reportId}`;
    try {
        const cached = await getCache(key);
        if (cached && Array.isArray(cached)) {
            console.log(`[Embedder] 💾 Cache HIT for reportId=${reportId} (${cached.length} chunks)`);
            return cached;
        }
    } catch (err) {
        console.error(`[Embedder] ⚠️  Redis getCachedChunks error (reportId=${reportId}):`, err.message);
    }
    console.log(`[Embedder] 🔄 Cache MISS for reportId=${reportId} — will embed fresh`);
    return null;
}

/**
 * Store enriched chunks in Redis with a 30-minute TTL.
 *
 * @param {string} reportId
 * @param {object[]} enrichedChunks
 * @returns {Promise<void>}
 */
async function cacheChunks(reportId, enrichedChunks) {
    if (!reportId || !Array.isArray(enrichedChunks)) return;
    const key = `${CACHE_KEY_PREFIX}:${reportId}`;
    try {
        const ok = await setCache(key, enrichedChunks, CACHE_TTL_SECONDS);
        if (ok) {
            console.log(`[Embedder] 💾 Cached ${enrichedChunks.length} chunks for reportId=${reportId} (TTL: ${CACHE_TTL_SECONDS}s)`);
        } else {
            console.warn(`[Embedder] ⚠️  setCache returned false for reportId=${reportId} — Redis may be offline`);
        }
    } catch (err) {
        console.error(`[Embedder] ⚠️  Redis cacheChunks error (reportId=${reportId}):`, err.message);
    }
}

/**
 * Invalidate the cached chunks for a specific report (call on resume save/update).
 *
 * @param {string} reportId
 * @returns {Promise<void>}
 */
async function invalidateChunkCache(reportId) {
    if (!reportId) return;
    const key = `${CACHE_KEY_PREFIX}:${reportId}`;
    try {
        await deleteCache(key);
        console.log(`[Embedder] 🗑️  Cache invalidated for reportId=${reportId}`);
    } catch (err) {
        console.error(`[Embedder] ⚠️  Cache invalidation error (reportId=${reportId}):`, err.message);
    }
}

// ─── Convenience: chunk + embed with cache-check ──────────────────────────────

/**
 * High-level helper: given already-parsed resume chunks and a reportId, check Redis
 * first and only embed if there's a cache miss. Returns enriched chunks[].
 *
 * @param {string}   reportId
 * @param {object[]} rawChunks  - Output of parseResumeHtml()
 * @returns {Promise<object[]>}
 */
async function getOrEmbedChunks(reportId, rawChunks) {
    if (!Array.isArray(rawChunks) || rawChunks.length === 0) return [];
    // 1. Try cache
    const cached = await getCachedChunks(reportId);
    if (cached) return cached;

    // 2. Embed fresh
    const enriched = await embedChunks(rawChunks);

    // 3. Persist to Redis
    await cacheChunks(reportId, enriched);

    return enriched;
}

/**
 * High-level helper: given already-parsed Roadmap chunks and a reportId, check Redis
 * first and only embed if there's a cache miss. Returns enriched chunks[].
 *
 * @param {string}   reportId
 * @param {object[]} rawChunks  - Output of parseRoadmap()
 * @returns {Promise<object[]>}
 */
async function getOrEmbedRoadmapChunks(reportId, rawChunks) {
    if (!Array.isArray(rawChunks) || rawChunks.length === 0) return [];
    const cacheKey = `roadmap_chunks:${reportId}`;
    try {
        const cached = await getCache(cacheKey);
        if (cached && Array.isArray(cached)) {
            console.log(`[Embedder] 💾 Cache HIT for Roadmap reportId=${reportId} (${cached.length} chunks)`);
            return cached;
        }
    } catch (err) {
        console.error(`[Embedder] ⚠️ Redis getOrEmbedRoadmapChunks error:`, err.message);
    }

    const enriched = await embedChunks(rawChunks);
    if (reportId && Array.isArray(enriched) && enriched.length > 0) {
        try {
            await setCache(cacheKey, enriched, CACHE_TTL_SECONDS);
        } catch (e) {}
    }
    return enriched;
}

/**
 * Invalidate Roadmap chunk cache for a report.
 */
async function invalidateRoadmapChunkCache(reportId) {
    if (!reportId) return;
    try {
        await deleteCache(`roadmap_chunks:${reportId}`);
        console.log(`[Embedder] 🗑️ Roadmap chunk cache invalidated for reportId=${reportId}`);
    } catch (err) {
        console.error(`[Embedder] ⚠️ Roadmap cache invalidation error:`, err.message);
    }
}

/**
 * High-level helper: given already-parsed JD chunks and a reportId, check Redis
 * first and only embed if there's a cache miss. Returns enriched chunks[].
 *
 * @param {string}   reportId
 * @param {object[]} rawChunks  - Output of parseJobDescription()
 * @returns {Promise<object[]>}
 */
async function getOrEmbedJdChunks(reportId, rawChunks) {
    if (!Array.isArray(rawChunks) || rawChunks.length === 0) return [];
    const cacheKey = `jd_chunks:${reportId}`;
    try {
        const cached = await getCache(cacheKey);
        if (cached && Array.isArray(cached)) {
            console.log(`[Embedder] 💾 Cache HIT for JD reportId=${reportId} (${cached.length} chunks)`);
            return cached;
        }
    } catch (err) {
        console.error(`[Embedder] ⚠️ Redis getOrEmbedJdChunks error:`, err.message);
    }

    const enriched = await embedChunks(rawChunks);
    if (reportId && Array.isArray(enriched) && enriched.length > 0) {
        try {
            await setCache(cacheKey, enriched, CACHE_TTL_SECONDS);
        } catch (e) {}
    }
    return enriched;
}

/**
 * Invalidate JD chunk cache for a report.
 */
async function invalidateJdChunkCache(reportId) {
    if (!reportId) return;
    try {
        await deleteCache(`jd_chunks:${reportId}`);
        console.log(`[Embedder] 🗑️ JD chunk cache invalidated for reportId=${reportId}`);
    } catch (err) {
        console.error(`[Embedder] ⚠️ JD cache invalidation error:`, err.message);
    }
}

/**
 * Invalidate all chunk caches (resume, roadmap, JD) for a given reportId.
 */
async function invalidateAllReportChunkCaches(reportId) {
    if (!reportId) return;
    await Promise.allSettled([
        invalidateChunkCache(reportId),
        invalidateRoadmapChunkCache(reportId),
        invalidateJdChunkCache(reportId)
    ]);
}

module.exports = {
    embedChunks,
    embedQuery,
    getCachedChunks,
    cacheChunks,
    invalidateChunkCache,
    getOrEmbedChunks,
    getOrEmbedRoadmapChunks,
    invalidateRoadmapChunkCache,
    getOrEmbedJdChunks,
    invalidateJdChunkCache,
    invalidateAllReportChunkCaches,
};
