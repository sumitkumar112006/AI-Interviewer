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
 * Uses Tavily API if configured, otherwise returns empty or fallback
 */
async function searchWeb(query, maxResults = 3) {
    if (!query || typeof query !== 'string') return [];

    const cacheKey = getSearchCacheKey('web', query);
    try {
        const cached = await getCache(cacheKey);
        if (cached && Array.isArray(cached)) {
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
                        type: 'web',
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
        } catch (e) {}
    }

    return results;
}

/**
 * Searches GitHub Repositories for Open Source Projects & Architectures
 */
async function searchGitHubProjects(topic, maxResults = 3) {
    if (!topic || typeof topic !== 'string') return [];

    const cleanTopic = topic.replace(/github|projects?|open[\s-]source|examples?|repo/gi, '').trim() || topic;
    const cacheKey = getSearchCacheKey('github', cleanTopic);

    try {
        const cached = await getCache(cacheKey);
        if (cached && Array.isArray(cached)) return cached;
    } catch (e) {}

    const results = [];

    // 1. Try public GitHub Search API
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
        // Fallback 1: Check curated GitHub projects bank
        const lower = cleanTopic.toLowerCase();
        for (const [key, repos] of Object.entries(CURATED_GITHUB_PROJECTS)) {
            if (lower.includes(key) || key.includes(lower)) {
                results.push(...repos.slice(0, maxResults));
                break;
            }
        }

        // Fallback 2: Tavily site:github.com search
        if (results.length < maxResults) {
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

    if (results.length > 0) {
        try { await setCache(cacheKey, results, 86400); } catch (e) {}
    }

    return results;
}

/**
 * Curated pattern bank + search for LeetCode / Coding problems
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
        if (cached && Array.isArray(cached)) return cached;
    } catch (e) {}

    const webResults = await searchWeb(`site:leetcode.com/problems ${topic} practice problem`, maxResults);
    const results = webResults.map(r => ({
        type: 'leetcode',
        title: r.title.startsWith('💡') ? r.title : `💡 ${r.title.replace(/\s*-\s*LeetCode/i, '')}`,
        url: r.url,
        snippet: r.snippet
    }));

    if (results.length > 0) {
        try { await setCache(cacheKey, results, 86400); } catch (e) {}
    }

    return results;
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
        if (cached && Array.isArray(cached)) return cached;
    } catch (e) {}

    // 1. Check Curated Docs Bank
    const curatedMatches = [];
    for (const [key, doc] of Object.entries(CURATED_DOCS)) {
        if (cleanTopic.includes(key) || key.includes(cleanTopic)) {
            curatedMatches.push({ type: 'doc', ...doc });
        }
    }

    if (curatedMatches.length >= maxResults) {
        try { await setCache(cacheKey, curatedMatches.slice(0, maxResults), 86400); } catch (e) {}
        return curatedMatches.slice(0, maxResults);
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

    const finalDocs = results.slice(0, maxResults);
    if (finalDocs.length > 0) {
        try { await setCache(cacheKey, finalDocs, 86400); } catch (e) {}
    }

    return finalDocs;
}

/**
 * Dynamic Multi-Source Search Orchestrator for Roadmap & Learning Resources
 * @param {Object} params
 * @param {string} params.topic - Skill, topic or roadmap day title
 * @param {string[]} [params.searchTypes] - e.g. ['github', 'leetcode', 'docs', 'video', 'web']
 * @param {number} [params.maxResults]
 * @returns {Promise<Array>} List of verified, typed resource objects
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

    const finalResults = combined.slice(0, maxResults);

    if (finalResults.length > 0) {
        try {
            await setCache(cacheKey, finalResults, 86400);
        } catch (e) {}
    }

    return finalResults;
}

/**
 * Backward-compatible YouTube & Learning Resource search
 */
async function searchLearningResources(skillOrTopic, maxResults = 3) {
    if (!skillOrTopic) return [];

    const query = `${skillOrTopic} interview preparation tutorials and roadmap`;
    const cacheKey = getSearchCacheKey('resources', query);

    try {
        const cached = await getCache(cacheKey);
        if (cached) return cached;
    } catch (e) {}

    const resources = [];
    const youtubeKey = process.env.YOUTUBE_API_KEY;

    if (youtubeKey) {
        try {
            const ytResp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                params: {
                    part: 'snippet',
                    q: `${skillOrTopic} full course tutorial`,
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
                        title: `▶️ ${item.snippet?.title || 'Tutorial Video'}`,
                        url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
                        snippet: item.snippet?.description || ''
                    });
                });
            }
        } catch (err) {
            console.error('[AI Assistant Resources] YouTube search failed:', err.message);
        }
    }

    // Fallback/Supplementary search via Tavily for official documentation
    if (resources.length < maxResults) {
        const webDocs = await searchWeb(`${skillOrTopic} official documentation cheatsheet`, maxResults);
        webDocs.forEach(doc => {
            resources.push({
                type: 'doc',
                title: `📖 ${doc.title}`,
                url: doc.url,
                snippet: doc.snippet
            });
        });
    }

    if (resources.length > 0) {
        try { await setCache(cacheKey, resources, 86400); } catch (e) {}
    }

    return resources;
}

module.exports = {
    searchWeb,
    searchGitHubProjects,
    searchLeetCodeProblems,
    searchOfficialDocs,
    searchDynamicRoadmapResources,
    searchLearningResources,
    getSearchCacheKey
};
