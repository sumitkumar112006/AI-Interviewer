const crypto = require('crypto');
const axios = require('axios');
const { getCache, setCache } = require('../services/redis.service');
const { GoogleGenAI } = require('@google/genai');
const { getManagedGeminiPool } = require('../config/aiKeys.config');

/**
 * Generates a consistent cache key for external search queries
 */
function getSearchCacheKey(prefix, query) {
    const hash = crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
    return `search:${prefix}:${hash}`;
}

/**
 * Validates and sanitizes a URL string
 */
function sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let clean = rawUrl.trim();
    // Strip trailing markdown punctuation, parentheses, quotes, or semicolons
    clean = clean.replace(/[\)\]\>\,\;\"\']+$/g, '').trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
        return null;
    }
    try {
        new URL(clean);
        return clean;
    } catch (e) {
        return null;
    }
}

/**
 * Resolves Google Grounding redirect URLs to their final canonical URLs
 */
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

/**
 * Strict YouTube video live check via official oEmbed API
 */
async function verifyYouTubeVideoUrl(url, timeoutMs = 2500) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (!match) return null;
    const videoId = match[1];
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const resp = await axios.get(oembedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            timeout: timeoutMs,
            validateStatus: (s) => s === 200
        });
        if (resp.status === 200 && resp.data && resp.data.title) {
            return {
                valid: true,
                title: resp.data.title,
                author: resp.data.author_name || '',
                url: `https://www.youtube.com/watch?v=${videoId}`
            };
        }
    } catch (e) {
        return null;
    }
    return null;
}

/**
 * Real-time fast URL health checker to filter out 404s, expired pages, or dead domains
 */
async function isUrlAlive(url, timeoutMs = 2500) {
    const clean = sanitizeUrl(url);
    if (!clean) return false;

    // Google Grounding redirect URLs are already verified by Google
    if (clean.includes('vertexaisearch.cloud.google.com')) {
        return true;
    }

    // 1. Strict verification for YouTube video URLs (oEmbed checks existence and public availability)
    if (/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/i.test(clean)) {
        const ytCheck = await verifyYouTubeVideoUrl(clean, timeoutMs);
        return Boolean(ytCheck && ytCheck.valid);
    }

    // YouTube search result pages or channel pages are valid if clean
    if (/youtube\.com\/(?:results\?search_query=|@|channel\/|c\/)/i.test(clean)) {
        return true;
    }

    try {
        const res = await axios.get(clean, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Range': 'bytes=0-100'
            },
            timeout: timeoutMs,
            maxRedirects: 4,
            validateStatus: (status) => status >= 200 && status < 400
        });
        return res.status >= 200 && res.status < 400;
    } catch (err) {
        // Many major services (GitHub, MDN, LeetCode, AWS) return 200/301 or 403 on byte range; check response status
        if (err.response && err.response.status >= 200 && err.response.status < 400) {
            return true;
        }
        // Known trusted developer & video authority domains with valid path structures can pass if error is bot block (403/429/timeout)
        if (err.response && (err.response.status === 403 || err.response.status === 429)) {
            const isTrustedDomain = /github\.com|leetcode\.com|react\.dev|nodejs\.org|developer\.mozilla\.org|docs\.docker\.com|postgresql\.org|mongodb\.com/i.test(clean);
            if (isTrustedDomain && !clean.includes('404')) {
                return true;
            }
        }
        return false;
    }
}

/**
 * Filters a list of resource candidates in parallel, discarding dead or unreachable links
 */
async function filterValidResources(resources) {
    if (!Array.isArray(resources) || resources.length === 0) return [];

    const checks = await Promise.allSettled(
        resources.map(async (item) => {
            const validUrl = sanitizeUrl(item.url);
            if (!validUrl) return null;
            const alive = await isUrlAlive(validUrl, 2500);
            if (alive) {
                return { ...item, url: validUrl };
            }
            return null;
        })
    );

    const validResults = [];
    const seenUrls = new Set();

    checks.forEach(c => {
        if (c.status === 'fulfilled' && c.value && !seenUrls.has(c.value.url)) {
            seenUrls.add(c.value.url);
            validResults.push(c.value);
        }
    });

    return validResults;
}

/**
 * Real-Time Google Search Grounding via Gemini
 * Fallback when Tavily is not configured or fails
 */
async function searchWebWithGeminiGrounding(query, maxResults = 3) {
    const keys = getManagedGeminiPool();
    if (keys.length === 0) return [];

    const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest'];
    const now = Date.now();

    for (const key of keys) {
        if (now < key.cooldownUntil) continue;

        for (const modelName of modelsToTry) {
            try {
                const client = new GoogleGenAI({ apiKey: key.key });
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

                const text = response.text || '';
                const results = [];

                // 1. Extract official Google Search Grounding chunks if available
                const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                if (Array.isArray(chunks) && chunks.length > 0) {
                    for (const chunk of chunks) {
                        if (chunk.web?.uri) {
                            const cleanUrl = sanitizeUrl(chunk.web.uri);
                            if (cleanUrl) {
                                const resolvedUrl = await resolveFinalUrl(cleanUrl, 2000);
                                results.push({
                                    type: 'web',
                                    title: chunk.web.title ? String(chunk.web.title).trim() : query,
                                    url: resolvedUrl,
                                    snippet: chunk.web.title ? `${chunk.web.title}` : `Verified web resource for ${query}.`
                                });
                            }
                        }
                    }
                }

                // 2. Try parsing JSON array from response text if grounding chunks were empty
                if (results.length === 0) {
                    const jsonMatch = text.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        try {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (Array.isArray(parsed)) {
                                for (const item of parsed) {
                                    const cleanUrl = sanitizeUrl(item.url);
                                    if (cleanUrl) {
                                        results.push({
                                            type: 'web',
                                            title: item.title ? String(item.title).trim() : query,
                                            url: cleanUrl,
                                            snippet: item.snippet ? String(item.snippet).trim() : ''
                                        });
                                    }
                                }
                            }
                        } catch (e) {}
                    }
                }

                // 3. Fallback: Parse markdown URLs if JSON was wrapped or formatted as list
                if (results.length === 0) {
                    const urlRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)|(?:<)?(https?:\/\/[^\s\>]+)(?:>)?/gi;
                    let m;
                    while ((m = urlRegex.exec(text)) !== null && results.length < maxResults) {
                        const title = m[1] || query;
                        const rawUrl = m[2] || m[3];
                        const cleanUrl = sanitizeUrl(rawUrl);
                        if (cleanUrl) {
                            results.push({
                                type: 'web',
                                title: title.replace(/^[\*\#\-\s]+|[\*\#\-\s]+$/g, '').trim(),
                                url: cleanUrl,
                                snippet: `Official web resource for ${query}.`
                            });
                        }
                    }
                }

                if (results.length > 0) {
                    return results.slice(0, maxResults);
                }
            } catch (err) {
                console.warn(`[AI Assistant Search] Gemini Grounding notice on ${modelName}:`, err?.message || err);
            }
        }
    }
    return [];
}

/**
 * Real-Time Web Search Tool with Redis Caching (TTL: 24h)
 * Uses Tavily API if configured, otherwise automatically falls back to Gemini Google Search Grounding
 */
async function searchWeb(query, maxResults = 3) {
    if (!query || typeof query !== 'string') return [];

    const cleanQuery = query.trim();
    const cacheKey = getSearchCacheKey('web', cleanQuery);
    try {
        const cached = await getCache(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) {
            return cached;
        }
    } catch (e) {
        // Continue if Redis is unavailable
    }

    let results = [];
    const tavilyKey = process.env.TAVILY_API_KEY;

    // 1. Try Tavily Search API if key exists
    if (tavilyKey) {
        try {
            const resp = await axios.post(
                'https://api.tavily.com/search',
                {
                    query: cleanQuery,
                    max_results: maxResults,
                    search_depth: 'basic',
                    include_answer: true
                },
                { timeout: 6000 }
            );

            if (resp.data?.results && Array.isArray(resp.data.results)) {
                resp.data.results.forEach(item => {
                    const cleanUrl = sanitizeUrl(item.url);
                    if (cleanUrl) {
                        results.push({
                            type: 'web',
                            title: item.title || cleanQuery,
                            url: cleanUrl,
                            snippet: item.content || item.snippet || ''
                        });
                    }
                });
            }
        } catch (err) {
            console.warn('[AI Assistant Search] Tavily search failed, falling back to Google Search Grounding:', err.message);
        }
    }

    // 2. Fallback: Google Search Grounding via Gemini 2.5 Flash if Tavily returned no results
    if (results.length === 0) {
        results = await searchWebWithGeminiGrounding(cleanQuery, maxResults);
    }

    // 3. Pre-flight health validation (filter out 404s and expired links)
    const validResults = await filterValidResources(results);
    const finalResults = validResults.slice(0, maxResults);

    // Cache results for 24 hours if found
    if (finalResults.length > 0) {
        try {
            await setCache(cacheKey, finalResults, 86400);
        } catch (e) {}
    }

    return finalResults;
}

/**
 * Curated pattern bank for LeetCode / Coding problems (All verified URLs)
 */
const CURATED_LEETCODE_TOPICS = {
    'binary search': [
        { title: '💡 Binary Search (LeetCode 704)', url: 'https://leetcode.com/problems/binary-search/', snippet: 'Search target in a sorted ascending array in O(log n).' },
        { title: '💡 Search in Rotated Sorted Array (LeetCode 33)', url: 'https://leetcode.com/problems/search-in-rotated-sorted-array/', snippet: 'Modified binary search with pivot detection in O(log n).' },
        { title: '💡 Find Minimum in Rotated Sorted Array (LeetCode 153)', url: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/', snippet: 'Locate inflection point via two-pointer binary search.' }
    ],
    'graphs': [
        { title: '💡 Number of Islands (LeetCode 200)', url: 'https://leetcode.com/problems/number-of-islands/', snippet: 'Graph traversal using DFS/BFS matrix grid search.' },
        { title: '💡 Course Schedule (LeetCode 207)', url: 'https://leetcode.com/problems/course-schedule/', snippet: 'Topological sort / Cycle detection in directed graph.' },
        { title: '💡 Clone Graph (LeetCode 133)', url: 'https://leetcode.com/problems/clone-graph/', snippet: 'Deep copy of undirected graph using hash map and BFS.' }
    ],
    'trees': [
        { title: '💡 Maximum Depth of Binary Tree (LeetCode 104)', url: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/', snippet: 'Classic recursive DFS and level-order BFS tree traversal.' },
        { title: '💡 Validate Binary Search Tree (LeetCode 98)', url: 'https://leetcode.com/problems/validate-binary-search-tree/', snippet: 'In-order traversal properties of valid BST.' },
        { title: '💡 Lowest Common Ancestor (LeetCode 236)', url: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/', snippet: 'Tree path tracking and lowest ancestor resolution.' }
    ],
    'dp': [
        { title: '💡 Climbing Stairs (LeetCode 70)', url: 'https://leetcode.com/problems/climbing-stairs/', snippet: 'Fundamental 1D dynamic programming state transition.' },
        { title: '💡 Coin Change (LeetCode 322)', url: 'https://leetcode.com/problems/coin-change/', snippet: 'Unbounded knapsack classic bottom-up DP table.' },
        { title: '💡 Longest Common Subsequence (LeetCode 1143)', url: 'https://leetcode.com/problems/longest-common-subsequence/', snippet: '2D grid DP for string sequence alignment.' }
    ],
    'two pointers': [
        { title: '💡 Two Sum II (LeetCode 167)', url: 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/', snippet: 'Two-pointer convergence on sorted input array.' },
        { title: '💡 3Sum (LeetCode 15)', url: 'https://leetcode.com/problems/3sum/', snippet: 'Sorting + two-pointer technique to find zero sum triplets.' }
    ],
    'array': [
        { title: '💡 Two Sum (LeetCode 1)', url: 'https://leetcode.com/problems/two-sum/', snippet: 'Array hash map lookup in O(n) time.' },
        { title: '💡 Best Time to Buy and Sell Stock (LeetCode 121)', url: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/', snippet: 'One-pass array sliding window min-price tracking.' },
        { title: '💡 Product of Array Except Self (LeetCode 238)', url: 'https://leetcode.com/problems/product-of-array-except-self/', snippet: 'Prefix and suffix product passes without division in O(n).' }
    ],
    'linked list': [
        { title: '💡 Reverse Linked List (LeetCode 206)', url: 'https://leetcode.com/problems/reverse-linked-list/', snippet: 'Iterative and recursive singly-linked list node pointer reversal.' },
        { title: '💡 Merge Two Sorted Lists (LeetCode 21)', url: 'https://leetcode.com/problems/merge-two-sorted-lists/', snippet: 'Splice list nodes together in ascending order.' },
        { title: '💡 Linked List Cycle (LeetCode 141)', url: 'https://leetcode.com/problems/linked-list-cycle/', snippet: 'Floyd cycle detection algorithm with slow and fast pointers.' }
    ],
    'stack': [
        { title: '💡 Valid Parentheses (LeetCode 20)', url: 'https://leetcode.com/problems/valid-parentheses/', snippet: 'LIFO bracket matching with stack hash map.' },
        { title: '💡 Min Stack (LeetCode 155)', url: 'https://leetcode.com/problems/min-stack/', snippet: 'Design stack supporting push, pop, top, and min retrieval in O(1).' }
    ],
    'queue': [
        { title: '💡 Implement Queue using Stacks (LeetCode 232)', url: 'https://leetcode.com/problems/implement-queue-using-stacks/', snippet: 'FIFO queue emulation with dual LIFO stacks.' },
        { title: '💡 Sliding Window Maximum (LeetCode 239)', url: 'https://leetcode.com/problems/sliding-window-maximum/', snippet: 'Monotonic deque for sliding window max in O(n).' }
    ],
    'sql': [
        { title: '💡 Combine Two Tables (LeetCode 175)', url: 'https://leetcode.com/problems/combine-two-tables/', snippet: 'SQL LEFT JOIN between Person and Address tables.' },
        { title: '💡 Second Highest Salary (LeetCode 176)', url: 'https://leetcode.com/problems/second-highest-salary/', snippet: 'SQL subquery / LIMIT OFFSET to find nth highest salary.' },
        { title: '💡 Duplicate Emails (LeetCode 182)', url: 'https://leetcode.com/problems/duplicate-emails/', snippet: 'SQL GROUP BY and HAVING count > 1.' }
    ]
};

const CURATED_DOCS = {
    'react': { title: '📖 React Official Documentation', url: 'https://react.dev', snippet: 'Official React docs, interactive tutorial, hooks reference, and best practices.' },
    'node': { title: '📖 Node.js Official Documentation', url: 'https://nodejs.org/en/docs', snippet: 'Node.js runtime API reference, event loop, streams, and modules.' },
    'nodejs': { title: '📖 Node.js Official Documentation', url: 'https://nodejs.org/en/docs', snippet: 'Node.js runtime API reference, event loop, streams, and modules.' },
    'express': { title: '📖 Express.js Official Guide', url: 'https://expressjs.com', snippet: 'Fast, unopinionated, minimalist web framework for Node.js API routing.' },
    'mongodb': { title: '📖 MongoDB Official Documentation', url: 'https://www.mongodb.com/docs/', snippet: 'MongoDB manual, query syntax, aggregation pipeline, and indexing guides.' },
    'postgresql': { title: '📖 PostgreSQL Official Documentation', url: 'https://www.postgresql.org/docs/', snippet: 'PostgreSQL relational database docs, SQL reference, transactions, and indexing.' },
    'postgres': { title: '📖 PostgreSQL Official Documentation', url: 'https://www.postgresql.org/docs/', snippet: 'PostgreSQL relational database docs, SQL reference, transactions, and indexing.' },
    'redis': { title: '📖 Redis Official Documentation', url: 'https://redis.io/docs/', snippet: 'In-memory data structure store, caching patterns, pub/sub, and streams.' },
    'docker': { title: '📖 Docker Official Documentation', url: 'https://docs.docker.com/', snippet: 'Containerization, Dockerfile reference, Docker Compose, and networking.' },
    'git': { title: '📖 Git Official Documentation & Book', url: 'https://git-scm.com/doc', snippet: 'Pro Git book, branch management, merge conflict resolution, and commands.' },
    'javascript': { title: '📖 MDN Web Docs: JavaScript', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', snippet: 'Comprehensive JavaScript reference, closures, promises, prototypes, and async/await.' },
    'typescript': { title: '📖 TypeScript Official Handbook', url: 'https://www.typescriptlang.org/docs/', snippet: 'Type system, generics, interfaces, union types, and tsconfig reference.' },
    'python': { title: '📖 Python 3 Official Documentation', url: 'https://docs.python.org/3/', snippet: 'Python language reference, standard library, OOP, and data structures.' },
    'fastapi': { title: '📖 FastAPI Official Documentation', url: 'https://fastapi.tiangolo.com/', snippet: 'High performance Python web framework, OpenAPI docs, and async endpoints.' },
    'nextjs': { title: '📖 Next.js Official Documentation', url: 'https://nextjs.org/docs', snippet: 'The React Framework for the Web, App Router, SSR, Server Actions, and API routes.' },
    'aws': { title: '📖 AWS Documentation', url: 'https://docs.aws.amazon.com/', snippet: 'Amazon Web Services cloud documentation, EC2, S3, Lambda, and IAM.' },
    'system design': { title: '📖 System Design Primer', url: 'https://github.com/donnemartin/system-design-primer', snippet: 'Learn how to design large-scale systems. Prep for the system design interview.' }
};

const CURATED_GITHUB_PROJECTS = {
    'react': [
        { title: '🐙 facebook/react (230k+ stars)', url: 'https://github.com/facebook/react', snippet: 'The library for web and native user interfaces.' },
        { title: '🐙 alan2207/bulletproof-react (27k+ stars)', url: 'https://github.com/alan2207/bulletproof-react', snippet: 'A simple, scalable, and powerful architecture for building production-ready React applications.' }
    ],
    'node': [
        { title: '🐙 goldbergyoni/nodebestpractices (100k+ stars)', url: 'https://github.com/goldbergyoni/nodebestpractices', snippet: 'The Node.js best practices list: security, architecture, code style, testing.' },
        { title: '🐙 santiq/bulletproof-nodejs (9k+ stars)', url: 'https://github.com/santiq/bulletproof-nodejs', snippet: 'Implementation of a 3-tier architecture pattern for Node.js REST APIs.' }
    ],
    'fastapi': [
        { title: '🐙 tiangolo/fastapi (80k+ stars)', url: 'https://github.com/tiangolo/fastapi', snippet: 'FastAPI framework, high performance, easy to learn, fast to code, ready for production.' },
        { title: '🐙 tiangolo/full-stack-fastapi-template (30k+ stars)', url: 'https://github.com/tiangolo/full-stack-fastapi-template', snippet: 'Full stack, modern web application template with FastAPI, PostgreSQL, Docker.' }
    ],
    'rag': [
        { title: '🐙 run-llama/llama_index (40k+ stars)', url: 'https://github.com/run-llama/llama_index', snippet: 'LlamaIndex is a data framework for LLM-based applications to ingest, structure, and access private data.' },
        { title: '🐙 langchain-ai/langchain (100k+ stars)', url: 'https://github.com/langchain-ai/langchain', snippet: 'Building applications with LLMs through composability and vector store retrieval.' }
    ]
};

const CURATED_YOUTUBE_VIDEOS = {
    'system design': [
        { title: '▶️ System Design Fundamentals (ByteByteGo)', url: 'https://www.youtube.com/playlist?list=PLCRMIe5FDPsd0g694274BtTkJcxp05kkg', snippet: 'Step-by-step system design architectures, scaling, load balancing, caching.' },
        { title: '▶️ System Design Interview Prep (Gaurav Sen)', url: 'https://www.youtube.com/playlist?list=PLMCXHnjXnTnvo6alSjVkgxV-VH6EPyvoX', snippet: 'Distributed systems, microservices, consistent hashing, and databases.' }
    ],
    'dsa': [
        { title: '▶️ Blind 75 LeetCode Problem Solutions (NeetCode)', url: 'https://www.youtube.com/playlist?list=PLot-Xpze53ldVwtstag2TL4HQhAnC8ATf', snippet: 'Optimal solutions and walkthroughs for the top 75 coding interview questions.' },
        { title: '▶️ Striver A2Z DSA Course (take U forward)', url: 'https://www.youtube.com/playlist?list=PLgUwDviBIf0oF6QL8m22w1hIDC1vJ_BHz', snippet: 'Complete step-by-step data structures and algorithms playlist from basic to advanced.' }
    ],
    'leetcode': [
        { title: '▶️ NeetCode 150 Algorithms & Data Structures', url: 'https://www.youtube.com/playlist?list=PLot-Xpze53ldVwtstag2TL4HQhAnC8ATf', snippet: 'Structured DSA patterns with step-by-step code walkthroughs in Python/Java/C++.' }
    ],
    'react': [
        { title: '▶️ React JS Full Course (freeCodeCamp)', url: 'https://www.youtube.com/watch?v=bMknfKXIFA8', snippet: 'Complete React crash course covering hooks, state management, components.' }
    ],
    'node': [
        { title: '▶️ Node.js and Express.js Full Course (freeCodeCamp)', url: 'https://www.youtube.com/watch?v=Oe421EPjeBE', snippet: 'Backend development with Node, Express, REST APIs, and middleware.' }
    ],
    'docker': [
        { title: '▶️ Docker Tutorial for Beginners (TechWorld with Nana)', url: 'https://www.youtube.com/watch?v=3c-iBn73dDE', snippet: 'Containerization, Dockerfile, Docker Compose, and image management.' }
    ],
    'product management': [
        { title: '▶️ Product Management Interview Prep (Exponent)', url: 'https://www.youtube.com/playlist?list=PL_PkWl_Tz6uS_i6o8b_jL2t4sQ4b7s_pY', snippet: 'Mock PM interviews, product design questions, execution, and strategy.' }
    ],
    'ai': [
        { title: '▶️ Large Language Models (LLMs) Intro (Andrej Karpathy)', url: 'https://www.youtube.com/watch?v=zjkBMFhNj_g', snippet: 'Deep-dive into how ChatGPT, LLMs, tokens, fine-tuning, and transformers work.' }
    ]
};

/**
 * Searches GitHub Repositories for Open Source Projects & Architectures
 */
async function searchGitHubProjects(topic, maxResults = 3) {
    if (!topic || typeof topic !== 'string') return [];

    const cleanTopic = topic.replace(/github|projects?|open[\s-]source|examples?|repo/gi, '').trim() || topic;
    const cacheKey = getSearchCacheKey('github', cleanTopic);

    try {
        const cached = await getCache(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    } catch (e) {}

    const results = [];

    // 1. Check curated GitHub projects bank first
    const lower = cleanTopic.toLowerCase();
    for (const [key, repos] of Object.entries(CURATED_GITHUB_PROJECTS)) {
        if (lower.includes(key) || key.includes(lower)) {
            repos.slice(0, maxResults).forEach(r => results.push({ type: 'github', ...r }));
            break;
        }
    }

    // 2. Try public GitHub Search API if needed
    if (results.length < maxResults) {
        try {
            const ghResp = await axios.get('https://api.github.com/search/repositories', {
                params: {
                    q: `${cleanTopic} stars:>100`,
                    sort: 'stars',
                    order: 'desc',
                    per_page: maxResults
                },
                headers: {
                    'User-Agent': 'KIVI-AI-Assistant-Dev'
                },
                timeout: 5000
            });

            if (ghResp.data?.items && Array.isArray(ghResp.data.items)) {
                ghResp.data.items.slice(0, maxResults).forEach(repo => {
                    results.push({
                        type: 'github',
                        title: `🐙 ${repo.full_name} (${(repo.stargazers_count || 0).toLocaleString()} stars)`,
                        url: repo.html_url,
                        snippet: repo.description ? `${repo.description} [Language: ${repo.language || 'Code'}]` : `GitHub open-source repository for ${cleanTopic}.`
                    });
                });
            }
        } catch (err) {
            // Fallback: Web search with site:github.com
            const webGh = await searchWeb(`site:github.com ${cleanTopic} open source repository`, maxResults - results.length);
            webGh.forEach(item => {
                results.push({
                    type: 'github',
                    title: item.title.startsWith('🐙') ? item.title : `🐙 ${item.title}`,
                    url: item.url,
                    snippet: item.snippet
                });
            });
        }
    }

    const validResults = await filterValidResources(results);
    const finalResults = validResults.slice(0, maxResults);

    if (finalResults.length > 0) {
        try { await setCache(cacheKey, finalResults, 86400); } catch (e) {}
    }

    return finalResults;
}

async function searchLeetCodeProblems(topic, maxResults = 3) {
    if (!topic || typeof topic !== 'string') return [];

    const lower = topic.toLowerCase();
    for (const [key, items] of Object.entries(CURATED_LEETCODE_TOPICS)) {
        if (lower.includes(key)) {
            return items.slice(0, maxResults).map(it => ({ type: 'leetcode', ...it }));
        }
    }

    const cacheKey = getSearchCacheKey('leetcode', topic);
    try {
        const cached = await getCache(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    } catch (e) {}

    const webResults = await searchWeb(`site:leetcode.com/problems ${topic} practice problem`, maxResults);
    const results = webResults.map(r => ({
        type: 'leetcode',
        title: r.title.startsWith('💡') ? r.title : `💡 ${r.title.replace(/\s*-\s*LeetCode/i, '')}`,
        url: r.url,
        snippet: r.snippet
    }));

    const validResults = await filterValidResources(results);
    const finalResults = validResults.slice(0, maxResults);

    if (finalResults.length > 0) {
        try { await setCache(cacheKey, finalResults, 86400); } catch (e) {}
    }

    return finalResults;
}

/**
 * Searches Official Documentation & Guides (MDN, React Docs, Node Docs, Docker Docs)
 */
async function searchOfficialDocs(topic, maxResults = 3) {
    if (!topic || typeof topic !== 'string') return [];

    const cleanTopic = topic.toLowerCase().trim();
    const cacheKey = getSearchCacheKey('docs', cleanTopic);
    try {
        const cached = await getCache(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    } catch (e) {}

    // 1. Check Curated Docs Bank
    const curatedMatches = [];
    for (const [key, doc] of Object.entries(CURATED_DOCS)) {
        if (cleanTopic.includes(key) || key.includes(cleanTopic)) {
            curatedMatches.push({ type: 'doc', ...doc });
        }
    }

    if (curatedMatches.length >= maxResults) {
        const valid = await filterValidResources(curatedMatches.slice(0, maxResults));
        if (valid.length > 0) {
            try { await setCache(cacheKey, valid, 86400); } catch (e) {}
            return valid;
        }
    }

    // 2. Web search for official docs
    const webResults = await searchWeb(`official documentation ${topic} cheatsheet guide`, maxResults);
    const results = [...curatedMatches];
    const seenUrls = new Set(curatedMatches.map(c => c.url));

    webResults.forEach(r => {
        if (r && r.url && !seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            results.push({
                type: 'doc',
                title: r.title.startsWith('📖') ? r.title : `📖 ${r.title}`,
                url: r.url,
                snippet: r.snippet
            });
        }
    });

    const validDocs = await filterValidResources(results);
    const finalDocs = validDocs.slice(0, maxResults);

    if (finalDocs.length > 0) {
        try { await setCache(cacheKey, finalDocs, 86400); } catch (e) {}
    }

    return finalDocs;
}

/**
 * Dynamic Multi-Source Search Orchestrator for Roadmap & Learning Resources
 */
async function searchDynamicRoadmapResources({ topic, searchTypes = ['web', 'docs', 'github'], maxResults = 4 }) {
    if (!topic || typeof topic !== 'string' || !topic.trim()) return [];

    const cleanTopic = topic.trim();
    const cacheKey = getSearchCacheKey('dynamic_res', `${cleanTopic}_${(searchTypes || []).sort().join('_')}`);

    try {
        const cached = await getCache(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) {
            return cached;
        }
    } catch (e) {}

    const promises = [];
    const lowerTopic = cleanTopic.toLowerCase();
    const wantsLeetCode = (searchTypes.includes('leetcode') || /dsa|algorithm|binary search|graph|tree|dynamic programming|array|stack|queue|leetcode/i.test(lowerTopic)) && !/rest api|docker|deployment|system design/i.test(lowerTopic);
    const wantsGitHub = searchTypes.includes('github') || /github|repo|project|code|implementation|architecture|open source/i.test(lowerTopic);
    const wantsDocs = searchTypes.includes('docs') || /docs|documentation|official|spec|guide/i.test(lowerTopic);
    const wantsVideo = searchTypes.includes('video') || /video|tutorial|watch|course|youtube/i.test(lowerTopic);

    if (wantsLeetCode) {
        promises.push(searchLeetCodeProblems(cleanTopic, 2));
    }
    if (wantsGitHub) {
        promises.push(searchGitHubProjects(cleanTopic, 2));
    }
    if (wantsDocs) {
        promises.push(searchOfficialDocs(cleanTopic, 2));
    }
    if (wantsVideo) {
        promises.push(searchLearningResources(cleanTopic, 2));
    }

    // Default web search fallback if no specific targets
    if (promises.length === 0) {
        promises.push(searchWeb(`${cleanTopic} tutorial documentation best practices`, maxResults));
        promises.push(searchGitHubProjects(cleanTopic, 2));
    }

    const settled = await Promise.allSettled(promises);
    const combined = [];
    const seenUrls = new Set();

    settled.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            res.value.forEach(item => {
                if (item && item.url && !seenUrls.has(item.url)) {
                    seenUrls.add(item.url);
                    combined.push(item);
                }
            });
        }
    });

    const validCombined = await filterValidResources(combined);
    const finalResults = validCombined.slice(0, maxResults);

    if (finalResults.length > 0) {
        try {
            await setCache(cacheKey, finalResults, 86400);
        } catch (e) {}
    }

    return finalResults;
}

/**
 * Real-time direct YouTube search scraper (Zero API key required)
 */
async function searchYouTubeDirect(query, maxResults = 3) {
    if (!query || typeof query !== 'string') return [];
    try {
        const searchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
        const resp = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 5000
        });

        const html = resp.data || '';
        const jsonStart = html.indexOf('var ytInitialData = ');
        if (jsonStart === -1) return [];

        const jsonStringStart = jsonStart + 'var ytInitialData = '.length;
        const jsonEnd = html.indexOf(';</script>', jsonStringStart);
        if (jsonEnd === -1) return [];

        const rawJson = html.substring(jsonStringStart, jsonEnd);
        const data = JSON.parse(rawJson);
        
        const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        const videos = [];
        if (Array.isArray(contents)) {
            for (const section of contents) {
                const itemSection = section?.itemSectionRenderer?.contents;
                if (Array.isArray(itemSection)) {
                    for (const item of itemSection) {
                        const vr = item?.videoRenderer;
                        if (vr && vr.videoId) {
                            const videoId = vr.videoId;
                            const title = vr.title?.runs?.[0]?.text || vr.title?.accessibility?.accessibilityData?.label || '';
                            const channel = vr.ownerText?.runs?.[0]?.text || '';
                            const snippet = vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map(r => r.text).join('') || '';
                            
                            if (videoId && title) {
                                videos.push({
                                    type: 'video',
                                    title: title.startsWith('▶️') ? title : `▶️ ${title}`,
                                    url: `https://www.youtube.com/watch?v=${videoId}`,
                                    snippet: snippet || (channel ? `Tutorial by ${channel}` : `YouTube video for ${query}`)
                                });
                            }
                            if (videos.length >= maxResults * 2) break;
                        }
                    }
                }
                if (videos.length >= maxResults * 2) break;
            }
        }
        return videos;
    } catch (err) {
        console.warn('[AI Assistant YouTube] Direct search warning:', err.message);
        return [];
    }
}

/**
 * YouTube & Learning Resource search with multi-tier real-time validation
 */
async function searchLearningResources(skillOrTopic, maxResults = 3) {
    if (!skillOrTopic) return [];

    const cleanTopic = skillOrTopic.toLowerCase().trim();
    const cacheKey = getSearchCacheKey('resources', cleanTopic);

    try {
        const cached = await getCache(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    } catch (e) {}

    const resources = [];

    // 1. Check curated YouTube video bank
    for (const [key, vids] of Object.entries(CURATED_YOUTUBE_VIDEOS)) {
        if (cleanTopic.includes(key) || key.includes(cleanTopic)) {
            vids.slice(0, maxResults).forEach(v => resources.push({ type: 'video', ...v }));
            break;
        }
    }

    // 2. Direct real-time YouTube Search Scraper (Fast, 0 API key required, 100% active results)
    if (resources.length < maxResults) {
        const directResults = await searchYouTubeDirect(`${cleanTopic} interview tutorial course`, maxResults * 2);
        directResults.forEach(r => {
            if (!resources.some(existing => existing.url === r.url)) {
                resources.push(r);
            }
        });
    }

    // 3. Fallback search via Tavily/Gemini Grounding for real YouTube video links
    if (resources.length < maxResults) {
        const ytWeb = await searchWeb(`site:youtube.com ${cleanTopic} tutorial video course`, maxResults * 2);
        ytWeb.forEach(item => {
            const clean = sanitizeUrl(item.url);
            if (clean && /youtube\.com|youtu\.be/i.test(clean) && !resources.some(existing => existing.url === clean)) {
                resources.push({
                    type: 'video',
                    title: item.title.startsWith('▶️') ? item.title : `▶️ ${item.title}`,
                    url: clean,
                    snippet: item.snippet || `YouTube tutorial for ${cleanTopic}`
                });
            }
        });
    }

    // 4. Strict Validation via YouTube oEmbed (filters out any deleted/fake/hallucinated videos)
    const validResources = await filterValidResources(resources);

    // 5. Guaranteed Fallback: If no single video was verified, provide the direct live YouTube Search link!
    if (validResources.length === 0) {
        validResources.push({
            type: 'video',
            title: `▶️ Live YouTube Search: ${skillOrTopic} Tutorials`,
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(skillOrTopic + ' tutorial interview preparation')}`,
            snippet: `Live curated YouTube tutorial and preparation videos for ${skillOrTopic}.`
        });
    }

    const finalResources = validResources.slice(0, maxResults);

    if (finalResources.length > 0) {
        try { await setCache(cacheKey, finalResources, 86400); } catch (e) {}
    }

    return finalResources;
}

module.exports = {
    searchWeb,
    searchGitHubProjects,
    searchLeetCodeProblems,
    searchOfficialDocs,
    searchDynamicRoadmapResources,
    searchLearningResources,
    searchYouTubeDirect,
    verifyYouTubeVideoUrl,
    getSearchCacheKey,
    isUrlAlive,
    filterValidResources
};
