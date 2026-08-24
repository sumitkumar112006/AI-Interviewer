const Redis = require('ioredis');

let redisClient = null;

function connectToRedis() {
    const isProduction = process.env.NODE_ENV === 'production';
    const isRailwayEnv = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL || process.env.REDISHOST || isProduction);

    let redisUrl = null;

    if (isRailwayEnv) {
        // --- PRODUCTION (RAILWAY REDIS) ---
        // Priority 1: Railway provided REDISHOST credentials
        if (process.env.REDISHOST) {
            const user = process.env.REDISUSER || 'default';
            const pass = process.env.REDISPASSWORD ? `:${process.env.REDISPASSWORD}@` : '';
            const host = process.env.REDISHOST;
            const port = process.env.REDISPORT || 6379;
            redisUrl = `redis://${user}${pass}${host}:${port}`;
        } 
        // Priority 2: Railway REDIS_URL (non-localhost)
        else if (process.env.REDIS_URL && !process.env.REDIS_URL.includes('127.0.0.1') && !process.env.REDIS_URL.includes('localhost')) {
            redisUrl = process.env.REDIS_URL;
        } 
        // Priority 3: Railway REDIS_PUBLIC_URL
        else if (process.env.REDIS_PUBLIC_URL) {
            redisUrl = process.env.REDIS_PUBLIC_URL;
        }
    }

    // --- LOCALHOST (LOCAL DOCKER REDIS) ---
    if (!redisUrl) {
        redisUrl = process.env.LOCAL_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    }

    const maskedUrl = redisUrl.replace(/:[^:@]+@/, ':****@');
    console.log(`Connecting to Redis [${isRailwayEnv ? 'Railway Production' : 'Localhost Redis'}]... [${maskedUrl}]`);

    try {
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 5) {
                    console.warn('⚠️ Redis connection attempts limit reached. Operating in in-memory fallback mode.');
                    return null;
                }
                const delay = Math.min(times * 1000, 3000);
                return delay;
            },
            lazyConnect: false,
            connectTimeout: 5000,
        });

        redisClient.on('connect', () => {
            console.log(`✅ Connected to Redis successfully [${isRailwayEnv ? 'Railway Production' : 'Localhost Redis'}] [${maskedUrl}]`);
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


