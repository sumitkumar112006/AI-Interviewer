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
 * For generation credits: uses MongoDB (user.generationsUsed & user.generationsResetAt) as source of truth
 * For AI assistant daily limits: still uses Redis (short-lived, daily reset is fine)
 * @param {Object} options
 * @param {string} options.prefix Key prefix (used to detect ai-assistant vs generation)
 * @param {number} options.windowSeconds Time window in seconds (default 2592000 = 30 days)
 * @param {Object} options.limits Tier limits e.g. { free: 2, pro: 10, premium: 25 }
 * @param {number} options.bonusMultiplier Multiplier for custom bonus credits (default 1, e.g. 3 for AI Assistant)
 * @param {string} options.message Error message returned when limit exceeded
 */
function createTieredRateLimiter(options = {}) {
    const {
        prefix = 'ratelimit:tiered',
        windowSeconds = 2592000, // Default 30-day monthly limit window
        limits = { free: 2, pro: 10, premium: 25 },
        bonusMultiplier = 1,
        message = 'Usage limit reached for your subscription tier. Upgrade your plan for higher limits.'
    } = options;

    const isAiAssistantLimiter = prefix.includes('ai-assistant');

    return async function tieredRateLimiterMiddleware(req, res, next) {
        try {
            const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'anonymous';
            const userId = req.user?.id || req.user?._id;
            const userPlan = (req.user?.plan || 'free').toLowerCase();

            const bonusCredits = isAiAssistantLimiter
                ? (req.user?.customAiBonusCredits !== undefined ? req.user.customAiBonusCredits : (req.user?.customBonusCredits ? req.user.customBonusCredits * 3 : 0))
                : (req.user?.customBonusCredits || 0);

            const baseRequests = limits[userPlan] !== undefined ? limits[userPlan] : (limits.free || 2);
            const maxRequests = Math.max(0, baseRequests + (bonusCredits * bonusMultiplier));

            // ─── AI Assistant: keep using Redis (daily limit, ephemeral is fine) ───
            if (isAiAssistantLimiter) {
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
                    return res.status(429).json({
                        message: `${message} (${userPlan.toUpperCase()} Plan limit: ${maxRequests} per day).`,
                        userPlan,
                        limit: maxRequests,
                        used: currentCount - 1,
                        remaining: 0,
                        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds
                    });
                }

                req.genCredits = { plan: userPlan, limit: maxRequests, used: currentCount, remaining };
                return next();
            }

            // ─── Generation Credits: use MongoDB as source of truth ───
            if (!userId) {
                // No authenticated user — fail open
                return next();
            }

            const userModel = require('../models/user.model');
            const subscriptionModel = require('../models/subscription.model');
            const now = new Date();

            // Fetch current user data from DB (fresh read to avoid stale req.user)
            let user = await userModel.findById(userId);
            if (!user) {
                return next();
            }

            // Check if the billing period has expired and reset if needed
            if (!user.generationsResetAt || now > user.generationsResetAt) {
                // Look up active subscription to get the real period end
                const subscription = await subscriptionModel.findOne({
                    userId: userId,
                    status: 'active'
                }).sort({ currentPeriodEnd: -1 });

                let newResetAt;
                if (subscription && subscription.currentPeriodEnd > now) {
                    // Use the subscription's period end
                    newResetAt = subscription.currentPeriodEnd;
                } else {
                    // No active subscription or it's also expired — start a fresh 30-day window
                    newResetAt = new Date(now.getTime() + (windowSeconds * 1000));
                }

                // Reset the counter, clear one-time bonus credits, and set new period end
                await userModel.findByIdAndUpdate(userId, {
                    generationsUsed: 0,
                    generationsResetAt: newResetAt,
                    customBonusCredits: 0,
                    customAiBonusCredits: 0
                });
                user.generationsUsed = 0;
                user.generationsResetAt = newResetAt;
                user.customBonusCredits = 0;
                user.customAiBonusCredits = 0;
            }

            const freshPlan = (user.plan || 'free').toLowerCase();
            const freshBase = limits[freshPlan] !== undefined ? limits[freshPlan] : (limits.free || 3);
            const freshBonus = user.customBonusCredits || 0;
            const currentMaxRequests = Math.max(0, freshBase + freshBonus);

            const currentCount = user.generationsUsed;
            const reservationResetAt = user.generationsResetAt;
            const ttlMs = user.generationsResetAt.getTime() - now.getTime();
            const ttlSeconds = Math.max(0, Math.ceil(ttlMs / 1000));

            // Atomic increment with limit check — prevents race conditions
            // Only increments if generationsUsed < currentMaxRequests
            const updatedUser = await userModel.findOneAndUpdate(
                { _id: userId, generationsUsed: { $lt: currentMaxRequests } },
                { $inc: { generationsUsed: 1 } },
                { returnDocument: 'after' }
            );

            const remaining = updatedUser
                ? Math.max(0, currentMaxRequests - updatedUser.generationsUsed)
                : 0;

            res.setHeader('X-RateLimit-Limit', currentMaxRequests);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-User-Plan', freshPlan);

            if (!updatedUser) {
                // Atomic update returned null — limit was already reached
                res.setHeader('Retry-After', ttlSeconds);
                return res.status(429).json({
                    message: `${message} (${freshPlan.toUpperCase()} Plan limit: ${currentMaxRequests} generations per month).`,
                    userPlan: freshPlan,
                    limit: currentMaxRequests,
                    used: currentCount,
                    remaining: 0,
                    retryAfterSeconds: ttlSeconds
                });
            }

            req.genCredits = {
                plan: freshPlan,
                limit: currentMaxRequests,
                used: updatedUser.generationsUsed,
                remaining
            };

            // Inject an idempotent refund function scoped to the reservation period
            let refunded = false;
            req.refundGeneration = async () => {
                if (refunded) return;
                refunded = true;
                await userModel.updateOne(
                    { _id: userId, generationsResetAt: reservationResetAt, generationsUsed: { $gt: 0 } },
                    { $inc: { generationsUsed: -1 } }
                );
            };

            next();
        } catch (err) {
            console.error('Tiered rate limiter error:', err.message);
            next(); // Fail open on unexpected errors
        }
    };
}

/**
 * Shared Generation Credit Limiter (Unified across Report, Resume, & Cover Letter Generation)
 * Now backed by MongoDB (user.generationsUsed) instead of Redis
 */
const { PLANS } = require('../constants/plans.constants');

const fullGenerationLimiter = createTieredRateLimiter({
    prefix: 'ratelimit:full-generation',
    windowSeconds: 2592000, // 30-day monthly limit
    limits: {
        free: PLANS?.FREE?.generationLimit || 3,
        pro: PLANS?.PRO?.generationLimit || 10,
        premium: PLANS?.PREMIUM?.generationLimit || 25
    },
    message: 'Generation credit limit reached for your plan.'
});

/**
 * Helper to fetch a user's current generation credits status
 * Reads from MongoDB instead of Redis — always accurate
 */
async function getUserGenCredits(user) {
    if (!user) return { plan: 'free', limit: 2, used: 0, remaining: 2 };

    const userModel = require('../models/user.model');
    const subscriptionModel = require('../models/subscription.model');
    const limits = { free: 2, pro: 10, premium: 25 };

    const userId = user.id || user._id;
    const now = new Date();

    // Fetch fresh user data from DB to avoid stale plan/bonus data
    let freshUser = await userModel.findById(userId);
    if (!freshUser) {
        const fallbackPlan = (user.plan || 'free').toLowerCase();
        const fallbackLimit = limits[fallbackPlan] || 2;
        return { plan: fallbackPlan, limit: fallbackLimit, used: 0, remaining: fallbackLimit };
    }



    // Check if the billing period has expired and reset if needed
    if (!freshUser.generationsResetAt || now > freshUser.generationsResetAt) {
        const subscription = await subscriptionModel.findOne({
            userId: userId,
            status: 'active'
        }).sort({ currentPeriodEnd: -1 });

        let newResetAt;
        if (subscription && subscription.currentPeriodEnd > now) {
            newResetAt = subscription.currentPeriodEnd;
        } else {
            newResetAt = new Date(now.getTime() + (2592000 * 1000)); // 30 days
        }

        await userModel.findByIdAndUpdate(userId, {
            generationsUsed: 0,
            generationsResetAt: newResetAt,
            customBonusCredits: 0,
            customAiBonusCredits: 0
        });
        freshUser.generationsUsed = 0;
        freshUser.generationsResetAt = newResetAt;
        freshUser.customBonusCredits = 0;
        freshUser.customAiBonusCredits = 0;
    }

    // Recompute limits after potential reset (bonus may have been cleared)
    const userPlan = (freshUser.plan || 'free').toLowerCase();
    const baseRequests = limits[userPlan] !== undefined ? limits[userPlan] : 2;
    const bonusCredits = freshUser.customBonusCredits || 0;
    const maxRequests = Math.max(0, baseRequests + bonusCredits);

    const currentCount = freshUser.generationsUsed || 0;

    return {
        plan: userPlan,
        limit: maxRequests,
        used: currentCount,
        remaining: Math.max(0, maxRequests - currentCount)
    };
}

module.exports = { createRateLimiter, createTieredRateLimiter, fullGenerationLimiter, getUserGenCredits };


