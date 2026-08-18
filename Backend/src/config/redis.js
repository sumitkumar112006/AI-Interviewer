const Redis = require('ioredis');

let redisClient = null;

function connectToRedis() {
    const isProduction = process.env.NODE_ENV === 'production';
    const isRailwayEnv = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL || isProduction);

    let redisUrl = 'redis://127.0.0.1:6379';

    if (isRailwayEnv) {
        // Inside Railway container network (Production)
        const railwayUrl = process.env.REDIS_RAILWAY_URL || process.env.REDIS_PRIVATE_URL;
        const mainUrl = process.env.REDIS_URL;

        if (railwayUrl) {
            redisUrl = railwayUrl;
        } else if (mainUrl) {
            redisUrl = mainUrl;
        } else if (process.env.REDISHOST) {
            const user = process.env.REDISUSER || 'default';
            const pass = process.env.REDISPASSWORD ? `:${process.env.REDISPASSWORD}@` : '';
            const host = process.env.REDISHOST;
            const port = process.env.REDISPORT || 6379;
            redisUrl = `redis://${user}${pass}${host}:${port}`;
        }
        if (!redisUrl) redisUrl = 'redis://127.0.0.1:6379';
    } else {
        // Local / External development machine
        if (process.env.REDIS_PUBLIC_URL) {
            redisUrl = process.env.REDIS_PUBLIC_URL;
        } else if (process.env.REDIS_URL && !process.env.REDIS_URL.includes('railway.internal')) {
            redisUrl = process.env.REDIS_URL;
        } else {
            console.log('ℹ️ Internal Railway host (railway.internal) detected in local mode.');
            console.log('ℹ️ Defaulting to local Docker Redis (redis://127.0.0.1:6379). Set REDIS_PUBLIC_URL in .env to connect to Railway Redis from local machine.');
            redisUrl = process.env.REDIS_LOCAL_URL || 'redis://127.0.0.1:6379';
        }
    }

    const maskedUrl = redisUrl.replace(/:[^:@]+@/, ':****@');
    console.log(`Connecting to Redis (${isRailwayEnv ? 'Railway/Production' : 'Development/Local'})... [${maskedUrl}]`);

    try {
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 5) {
                    console.warn('⚠️ Redis connection attempts limit reached. Operating in fallback mode.');
                    return null;
                }
                const delay = Math.min(times * 1000, 3000);
                return delay;
            },
            lazyConnect: false,
            connectTimeout: 5000,
        });

        redisClient.on('connect', () => {
            console.log(`✅ Connected to Redis successfully [${maskedUrl}]`);
        });

        redisClient.on('error', (err) => {
            console.error('⚠️ Redis connection error:', err.message);
        });

        redisClient.on('reconnecting', () => {
            console.log('🔄 Redis reconnecting...');
        });

        return redisClient;
    } catch (err) {
        console.error('Failed to create Redis client:', err);
        throw err;
    }
}

function getRedisClient() {
    if (!redisClient) {
        throw new Error('Redis not initialized. Call connectToRedis() first.');
    }
    return redisClient;
}

module.exports = { connectToRedis, getRedisClient };


