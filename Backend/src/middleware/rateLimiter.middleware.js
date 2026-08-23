const { getRedisClient } = require('../config/redis');

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
            let redis;
            try {
                redis = getRedisClient();
                if (!redis || (redis.status !== 'ready' && redis.status !== 'connect')) {
                    return next();
                }
            } catch (err) {
                // If Redis is offline or not ready, pass through safely without blocking user
                return next();
            }

            const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'anonymous';
            const identifier = req.user?.id || clientIp;
            const key = `${prefix}:${identifier}`;

            const currentCount = await redis.incr(key);

            if (currentCount === 1) {
                await redis.expire(key, windowSeconds);
            }

            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));

            if (currentCount > maxRequests) {
                const ttl = await redis.ttl(key);
                res.setHeader('Retry-After', ttl > 0 ? ttl : windowSeconds);

                return res.status(429).json({
                    message,
                    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds
                });
            }

            next();
        } catch (err) {
            console.error('Rate limiter error:', err.message);
            next(); // Fail open so API stays functional
        }
    };
}

/**
 * Creates a tier-aware rate limiter (Free vs. Pro/Paid users)
 * @param {Object} options
 * @param {string} options.prefix Redis key prefix
 * @param {number} options.windowSeconds Time window in seconds (default 86400 = 24 hrs)
 * @param {Object} options.limits Tier limits e.g. { free: 5, pro: 50, premium: 200 }
 * @param {string} options.message Error message returned when limit exceeded
 */
function createTieredRateLimiter(options = {}) {
    const {
        prefix = 'ratelimit:tiered',
        windowSeconds = 86400, // 24 hours daily limit window
        limits = { free: 5, pro: 50, premium: 200 },
        message = 'Usage limit reached for your subscription tier. Upgrade your plan for higher limits.'
    } = options;

    return async function tieredRateLimiterMiddleware(req, res, next) {
        try {
            let redis;
            try {
                redis = getRedisClient();
                if (!redis || (redis.status !== 'ready' && redis.status !== 'connect')) {
                    return next();
                }
            } catch (err) {
                return next();
            }

            const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'anonymous';
            const userId = req.user?.id || req.user?._id;
            const userPlan = (req.user?.plan || 'free').toLowerCase();
            const bonusCredits = req.user?.customBonusCredits || 0;

            const baseRequests = limits[userPlan] !== undefined ? limits[userPlan] : (limits.free || 5);
            const maxRequests = baseRequests + bonusCredits;
            const identifier = userId ? `user:${userId}` : `ip:${clientIp}`;
            const key = `${prefix}:${userPlan}:${identifier}`;

            const currentCount = await redis.incr(key);

            if (currentCount === 1) {
                await redis.expire(key, windowSeconds);
            }

            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));
            res.setHeader('X-User-Plan', userPlan);

            if (currentCount > maxRequests) {
                const ttl = await redis.ttl(key);
                res.setHeader('Retry-After', ttl > 0 ? ttl : windowSeconds);

                return res.status(429).json({
                    message: `${message} (${userPlan.toUpperCase()} Plan limit: ${maxRequests} requests per ${windowSeconds >= 86400 ? 'day' : 'window'}).`,
                    userPlan,
                    limit: maxRequests,
                    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds
                });
            }

            next();
        } catch (err) {
            console.error('Tiered rate limiter error:', err.message);
            next();
        }
    };
}

module.exports = { createRateLimiter, createTieredRateLimiter };
