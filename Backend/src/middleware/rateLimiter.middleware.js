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

            const identifier = req.user?.id || req.ip || req.headers['x-forwarded-for'] || 'anonymous';
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

module.exports = { createRateLimiter };
