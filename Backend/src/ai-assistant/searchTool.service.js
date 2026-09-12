const crypto = require('crypto');
const axios = require('axios');
const { getCache, setCache } = require('../services/redis.service');

/**
 * Generates a consistent cache key for external search queries
 */
function getSearchCacheKey(prefix, query) {
    const hash = crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
    return `search:${prefix}:${hash}`;
}

/**
 * Real-Time Web Search Tool with Redis Caching (TTL: 24h)
 * Uses Tavily API if configured, otherwise falls back to DuckDuckGo / web search endpoint
 */
async function searchWeb(query, maxResults = 3) {
    if (!query || typeof query !== 'string') return [];
    
    const cacheKey = getSearchCacheKey('web', query);
    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            return cached;
        }
    } catch (e) {
        // Continue if Redis is unavailable
    }

    const results = [];
    const tavilyKey = process.env.TAVILY_API_KEY;

    if (tavilyKey) {
        try {
            const resp = await axios.post(
                'https://api.tavily.com/search',
                {
                    query,
                    max_results: maxResults,
                    search_depth: 'basic',
                    include_answer: true
                },
                { timeout: 7000 }
            );

            if (resp.data?.results) {
                resp.data.results.forEach(item => {
                    results.push({
                        title: item.title,
                        url: item.url,
                        snippet: item.content || item.snippet || ''
                    });
                });
            }
        } catch (err) {
            console.error('[AI Assistant Search] Tavily search failed:', err.message);
        }
    }

    // Cache results for 24 hours if found
    if (results.length > 0) {
        try {
            await setCache(cacheKey, results, 86400);
        } catch (e) {
            // Ignore cache write error
        }
    }

    return results;
}

/**
 * Learning Resource Search Tool (Tutorials, Docs, YouTube links) with Redis Caching (TTL: 24h)
 */
async function searchLearningResources(skillOrTopic, maxResults = 3) {
    if (!skillOrTopic) return [];
    
    const query = `${skillOrTopic} interview preparation tutorials and roadmap`;
    const cacheKey = getSearchCacheKey('resources', query);

    try {
        const cached = await getCache(cacheKey);
        if (cached) {
            return cached;
        }
    } catch (e) {
        // Continue if Redis unavailable
    }

    const resources = [];
    const youtubeKey = process.env.YOUTUBE_API_KEY;

    if (youtubeKey) {
        try {
            const ytResp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                params: {
                    part: 'snippet',
                    q: `${skillOrTopic} interview full course tutorial`,
                    type: 'video',
                    maxResults,
                    key: youtubeKey
                },
                timeout: 5000
            });

            if (ytResp.data?.items) {
                ytResp.data.items.forEach(item => {
                    resources.push({
                        type: 'video',
                        title: item.snippet?.title,
                        url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
                        description: item.snippet?.description
                    });
                });
            }
        } catch (err) {
            console.error('[AI Assistant Resources] YouTube search failed:', err.message);
        }
    }

    // Fallback/Supplementary search via Tavily for official documentation and roadmaps
    if (resources.length < maxResults) {
        const webDocs = await searchWeb(`${skillOrTopic} official documentation cheatsheet roadmap`, maxResults);
        webDocs.forEach(doc => {
            resources.push({
                type: 'doc',
                title: doc.title,
                url: doc.url,
                description: doc.snippet
            });
        });
    }

    if (resources.length > 0) {
        try {
            await setCache(cacheKey, resources, 86400);
        } catch (e) {
            // Ignore cache write error
        }
    }

    return resources;
}

module.exports = {
    searchWeb,
    searchLearningResources,
    getSearchCacheKey
};
