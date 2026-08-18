const { getRedisClient } = require('../config/redis');

// In-Memory Fallback Cache (Active when Redis is offline or disconnected)
const memoryStore = new Map();

function setMemoryFallback(key, value, ttlSeconds) {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    memoryStore.set(key, { value, expiresAt });
}

function getMemoryFallback(key) {
    const record = memoryStore.get(key);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
        memoryStore.delete(key);
        return null;
    }
    return record.value;
}

function deleteMemoryFallback(key) {
    memoryStore.delete(key);
}

/**
 * Safe wrapper for Redis client operations with fallback support
 */
function getClientSafely() {
    try {
        const client = getRedisClient();
        if (client && (client.status === 'ready' || client.status === 'connect')) {
            return client;
        }
        return null;
    } catch (err) {
        return null;
    }
}

/* ==================== OTP OPERATIONS ==================== */

/**
 * Save OTP in Redis (or memory fallback) with 5 minutes (300 seconds) expiration
 */
async function setOtpInRedis(email, otp, ttlSeconds = 300) {
    const key = `auth:otp:${email.trim().toLowerCase()}`;
    const cleanOtp = String(otp).trim();
    
    // Always store in memory fallback
    setMemoryFallback(key, cleanOtp, ttlSeconds);

    const client = getClientSafely();
    if (client) {
        try {
            await client.set(key, cleanOtp, 'EX', ttlSeconds);
        } catch (err) {
            console.error('Redis setOtp fallback error:', err.message);
        }
    }
    return true;
}

/**
 * Get OTP from Redis (or memory fallback)
 */
async function getOtpFromRedis(email) {
    const key = `auth:otp:${email.trim().toLowerCase()}`;
    const client = getClientSafely();

    if (client) {
        try {
            const redisVal = await client.get(key);
            if (redisVal) return redisVal;
        } catch (err) {
            console.error('Redis getOtp fallback error:', err.message);
        }
    }

    return getMemoryFallback(key);
}

/**
 * Delete OTP from Redis (and memory fallback) after verification
 */
async function deleteOtpFromRedis(email) {
    const key = `auth:otp:${email.trim().toLowerCase()}`;
    deleteMemoryFallback(key);

    const client = getClientSafely();
    if (client) {
        try {
            await client.del(key);
        } catch (err) {
            console.error('Redis deleteOtp fallback error:', err.message);
        }
    }
    return true;
}

/* ==================== TOKEN BLACKLIST OPERATIONS ==================== */

/**
 * Blacklist a JWT token in Redis (and memory fallback) until its expiration
 */
async function blacklistTokenInRedis(token, ttlSeconds = 86400) {
    const key = `auth:blacklist:${token}`;
    setMemoryFallback(key, '1', ttlSeconds);

    const client = getClientSafely();
    if (client) {
        try {
            await client.set(key, '1', 'EX', ttlSeconds);
        } catch (err) {
            console.error('Redis blacklistToken fallback error:', err.message);
        }
    }
    return true;
}

/**
 * Check if a JWT token is blacklisted in Redis (or memory fallback)
 */
async function isTokenBlacklistedInRedis(token) {
    const key = `auth:blacklist:${token}`;
    const client = getClientSafely();

    if (client) {
        try {
            const exists = await client.exists(key);
            return exists === 1;
        } catch (err) {
            console.error('Redis isTokenBlacklisted fallback error:', err.message);
        }
    }

    const memRecord = memoryStore.get(key);
    if (memRecord) {
        return getMemoryFallback(key) === '1';
    }

    return null;
}

/* ==================== GENERIC CACHING OPERATIONS ==================== */

/**
 * Get cached JSON data by key
 */
async function getCache(key) {
    const client = getClientSafely();
    if (!client) return null;
    try {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error(`Redis getCache error for key ${key}:`, err.message);
        return null;
    }
}

/**
 * Set cached JSON data with TTL (default 10 mins = 600s)
 */
async function setCache(key, data, ttlSeconds = 600) {
    const client = getClientSafely();
    if (!client) return false;
    try {
        await client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
        return true;
    } catch (err) {
        console.error(`Redis setCache error for key ${key}:`, err.message);
        return false;
    }
}

/**
 * Delete a specific key or list of keys from Redis
 */
async function deleteCache(...keys) {
    const client = getClientSafely();
    if (!client || !keys.length) return false;
    try {
        const validKeys = keys.filter(Boolean);
        if (validKeys.length > 0) {
            await client.del(...validKeys);
        }
        return true;
    } catch (err) {
        console.error('Redis deleteCache error:', err.message);
        return false;
    }
}

/**
 * Delete keys matching a pattern (e.g. cache:reports:user:123*)
 */
async function deleteCachePattern(pattern) {
    const client = getClientSafely();
    if (!client) return false;
    try {
        const keys = await client.keys(pattern);
        if (keys && keys.length > 0) {
            await client.del(...keys);
        }
        return true;
    } catch (err) {
        console.error(`Redis deleteCachePattern error for pattern ${pattern}:`, err.message);
        return false;
    }
}

module.exports = {
    setOtpInRedis,
    getOtpFromRedis,
    deleteOtpFromRedis,
    blacklistTokenInRedis,
    isTokenBlacklistedInRedis,
    getCache,
    setCache,
    deleteCache,
    deleteCachePattern,
};
