require('dotenv').config({ path: 'Backend/.env' });
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const { getManagedGeminiPool } = require('../config/aiKeys.config');

function sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let clean = rawUrl.trim().replace(/[\)\]\>\,\;\"\']+$/g, '').trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) return null;
    try {
        new URL(clean);
        return clean;
    } catch (e) {
        return null;
    }
}

async function resolveFinalUrl(url, timeoutMs = 2500) {
    if (!url || typeof url !== 'string') return url;
    if (url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect')) {
        try {
            const resp = await axios.get(url, { maxRedirects: 5, timeout: timeoutMs });
            const finalUrl = resp.request?.res?.responseUrl || resp.config?.url;
            if (finalUrl && finalUrl.startsWith('http') && !finalUrl.includes('vertexaisearch')) {
                return finalUrl;
            }
        } catch (e) {}
    }
    return url;
}

async function testSearchWebWithGrounding(query, maxResults = 3) {
    const keys = getManagedGeminiPool();
    for (const key of keys) {
        const client = new GoogleGenAI({ apiKey: key.key });
        const models = ['gemini-2.5-flash', 'gemini-flash-latest'];
        for (const modelName of models) {
            try {
                const response = await client.models.generateContent({
                    model: modelName,
                    contents: `Find the top ${maxResults} authoritative, exact web links for this search query: "${query}".
Output a JSON array of objects, each with "title" (string), "url" (exact working https URL), and "snippet" (1-2 sentence description).
Do not invent URLs. Use only real verified websites.
Respond with JSON only.`,
                    config: {
                        tools: [{ googleSearch: {} }]
                    }
                });

                const results = [];
                const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                if (Array.isArray(chunks) && chunks.length > 0) {
                    for (const chunk of chunks) {
                        if (chunk.web?.uri) {
                            const cleanUrl = sanitizeUrl(chunk.web.uri);
                            if (cleanUrl) {
                                const resolvedUrl = await resolveFinalUrl(cleanUrl);
                                results.push({
                                    type: 'web',
                                    title: chunk.web.title ? String(chunk.web.title).trim() : query,
                                    url: resolvedUrl,
                                    snippet: `Official web resource: ${chunk.web.title || query}`
                                });
                            }
                        }
                    }
                }
                if (results.length > 0) {
                    return results.slice(0, maxResults);
                }
            } catch (err) {
                console.warn(`Error on ${modelName}:`, err.message);
            }
        }
    }
    return [];
}

async function main() {
    console.log('Testing Live Web Search with Google Grounding:');
    const res = await testSearchWebWithGrounding('Five9 software engineer interview process rounds', 3);
    console.log('Final Verified Web Results:', JSON.stringify(res, null, 2));
}

main();
