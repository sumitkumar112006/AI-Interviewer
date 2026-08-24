const { getRedisClient } = require('../config/redis');

// In-memory store for rate limiting when Redis is offline or disconnected
const memoryRateLimitStore = new Map();

function getMemoryCount(key, windowSeconds) {
    const now = Date.now();
    const record = memoryRateLimitStore.get(key);
    if (!record || now > record.resetAt) {
        const resetAt = now + (windowSeconds * 1000);
        memoryRateLimitStore.set(key, { count: 1, resetAt });
        return { currentCount: 1, ttl: windowSeconds };
    }
    record.count += 1;
    const ttl = Math.ceil((record.resetAt - now) / 1000);
    return { currentCount: record.count, ttl: ttl > 0 ? ttl : windowSeconds };
}

/**
 * Creates a Redis-backed rate limiting middleware
 * @param {Object} options
 * @param {string} options.prefix Prefix for Redis key (e.g., 'ratelimit:auth')
 * @param {number} options.windowSeconds Time window in seconds (default 60s)
 * @param {number} options.maxRequests Max requests allowed within window (default 10)
 * @param {string} options.message Error message returned when limit exceeded
 */
function createRateLimiter(options = {}) {
    const {
        prefix = 'ratelimit',
        windowSeconds = 60,
        maxRequests = 10,
        message = 'Too many requests. Please try again later.'
    } = options;

    return async function rateLimiterMiddleware(req, res, next) {
        try {
            const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'anonymous';
            const identifier = req.user?.id || clientIp;
            const key = `${prefix}:${identifier}`;

            let currentCount = 0;
            let ttl = windowSeconds;
            let isRedisWorking = false;

            try {
                const redis = getRedisClient();
                if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
                    currentCount = await redis.incr(key);
                    if (currentCount === 1) {
                        await redis.expire(key, windowSeconds);
                    }
                    ttl = await redis.ttl(key);
                    isRedisWorking = true;
                }
            } catch (rErr) {
                isRedisWorking = false;
            }

            if (!isRedisWorking) {
                const mem = getMemoryCount(key, windowSeconds);
                currentCount = mem.currentCount;
                ttl = mem.ttl;
            }

            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));

            if (currentCount > maxRequests) {
                res.setHeader('Retry-After', ttl > 0 ? ttl : windowSeconds);

                return res.status(429).json({
                    message,
                    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds
                });
            }

            next();
        } catch (err) {
            console.error('Rate limiter error:', err.message);
            next(); // Fail open if unexpected runtime error occurs
        }
    };
}

/**
 * Creates a tier-aware rate limiter (Free vs. Pro/Paid users)
 * @param {Object} options
 * @param {string} options.prefix Redis key prefix
 * @param {number} options.windowSeconds Time window in seconds (default 86400 = 24 hrs)
 * @param {Object} options.limits Tier limits e.g. { free: 2, pro: 10, premium: 25 }
 * @param {number} options.bonusMultiplier Multiplier for custom bonus credits (default 1, e.g. 3 for AI Assistant)
 * @param {string} options.message Error message returned when limit exceeded
 */
function createTieredRateLimiter(options = {}) {
    const {
        prefix = 'ratelimit:tiered',
        windowSeconds = 2592000, // Default 30-day monthly limit window (2,592,000s)
        limits = { free: 2, pro: 10, premium: 25 },
        bonusMultiplier = 1,
        message = 'Usage limit reached for your subscription tier. Upgrade your plan for higher limits.'
    } = options;

    return async function tieredRateLimiterMiddleware(req, res, next) {
        try {
            const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'anonymous';
            const userId = req.user?.id || req.user?._id;
            const userPlan = (req.user?.plan || 'free').toLowerCase();

            const isAiLimiter = prefix.includes('ai-assistant');
            const bonusCredits = isAiLimiter
                ? (req.user?.customAiBonusCredits !== undefined ? req.user.customAiBonusCredits : (req.user?.customBonusCredits ? req.user.customBonusCredits * 3 : 0))
                : (req.user?.customBonusCredits || 0);

            const baseRequests = limits[userPlan] !== undefined ? limits[userPlan] : (limits.free || 2);
            const maxRequests = Math.max(0, baseRequests + (bonusCredits * bonusMultiplier));
            const identifier = userId ? `user:${userId}` : `ip:${clientIp}`;
            const key = `${prefix}:${identifier}`;

            let currentCount = 0;
            let ttl = windowSeconds;
            let isRedisWorking = false;

            try {
                const redis = getRedisClient();
                if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
                    currentCount = await redis.incr(key);
                    if (currentCount === 1) {
                        await redis.expire(key, windowSeconds);
                    }
                    ttl = await redis.ttl(key);
                    isRedisWorking = true;
                }
            } catch (rErr) {
                isRedisWorking = false;
            }

            if (!isRedisWorking) {
                const mem = getMemoryCount(key, windowSeconds);
                currentCount = mem.currentCount;
                ttl = mem.ttl;
            }

            const remaining = Math.max(0, maxRequests - currentCount);

            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-User-Plan', userPlan);

            if (currentCount > maxRequests) {
                res.setHeader('Retry-After', ttl > 0 ? ttl : windowSeconds);
                const windowUnit = windowSeconds >= 2592000 ? 'month' : (windowSeconds >= 86400 ? 'day' : 'window');

                return res.status(429).json({
                    message: `${message} (${userPlan.toUpperCase()} Plan limit: ${maxRequests} generations per ${windowUnit}).`,
                    userPlan,
                    limit: maxRequests,
                    used: currentCount - 1,
                    remaining: 0,
                    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds
                });
            }

            req.genCredits = {
                plan: userPlan,
                limit: maxRequests,
                used: currentCount,
                remaining
            };

            next();
        } catch (err) {
            console.error('Tiered rate limiter error:', err.message);
            next();
        }
    };
}

/**
 * Shared Generation Credit Limiter (Unified across Report, Resume, & Cover Letter Generation)
 */
const fullGenerationLimiter = createTieredRateLimiter({
    prefix: 'ratelimit:full-generation',
    windowSeconds: 2592000, // 30-day monthly limit
    limits: { free: 2, pro: 10, premium: 25 },
    message: 'Generation credit limit reached for your plan.'
});

/**
 * Helper to fetch a user's current generation credits status
 */
async function getUserGenCredits(user) {
    if (!user) return { plan: 'free', limit: 2, used: 0, remaining: 2 };
    const userPlan = (user.plan || 'free').toLowerCase();
    const limits = { free: 2, pro: 10, premium: 25 };
    const baseRequests = limits[userPlan] !== undefined ? limits[userPlan] : 2;
    const bonusCredits = user.customBonusCredits || 0;
    const maxRequests = Math.max(0, baseRequests + bonusCredits);

    const userId = user.id || user._id;
    const key = `ratelimit:full-generation:user:${userId}`;

    let currentCount = 0;
    try {
        const redis = getRedisClient();
        if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
            const val = await redis.get(key);
            currentCount = val ? parseInt(val, 10) : 0;
        } else {
            const record = memoryRateLimitStore.get(key);
            currentCount = record ? record.count : 0;
        }
    } catch (err) {
        const record = memoryRateLimitStore.get(key);
        currentCount = record ? record.count : 0;
    }

    return {
        plan: userPlan,
        limit: maxRequests,
        used: currentCount,
        remaining: Math.max(0, maxRequests - currentCount)
    };
}

module.exports = { createRateLimiter, createTieredRateLimiter, fullGenerationLimiter, getUserGenCredits };

