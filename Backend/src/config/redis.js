const Redis = require('ioredis');

let redisClient = null;

function connectToRedis() {
    const isProduction = process.env.NODE_ENV === 'production';
    const isCloudEnv = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL || process.env.REDISHOST || isProduction);

    let redisUrl = null;

    if (isCloudEnv) {
        // Priority 1: Full REDIS_URL (Upstash / Cloud / Railway)
        if (process.env.REDIS_URL && !process.env.REDIS_URL.includes('127.0.0.1') && !process.env.REDIS_URL.includes('localhost')) {
            redisUrl = process.env.REDIS_URL;
        } 
        // Priority 2: REDISHOST credentials
        else if (process.env.REDISHOST) {
            const user = process.env.REDISUSER || 'default';
            const pass = process.env.REDISPASSWORD ? `:${process.env.REDISPASSWORD}@` : '';
            const host = process.env.REDISHOST;
            const port = process.env.REDISPORT || 6379;
            const isTls = host.includes('upstash.io') || process.env.REDIS_TLS === 'true';
            redisUrl = `${isTls ? 'rediss' : 'redis'}://${user}${pass}${host}:${port}`;
        } 
        // Priority 3: REDIS_PUBLIC_URL
        else if (process.env.REDIS_PUBLIC_URL) {
            redisUrl = process.env.REDIS_PUBLIC_URL;
        }
    }

    // --- LOCALHOST (LOCAL DOCKER REDIS) ---
    if (!redisUrl) {
        redisUrl = process.env.LOCAL_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    }

    const isTlsRequired = redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io');
    const maskedUrl = redisUrl.replace(/:[^:@]+@/, ':****@');
    console.log(`Connecting to Redis [${isCloudEnv ? 'Cloud/Upstash Production' : 'Localhost Redis'}]... [${maskedUrl}] (TLS: ${isTlsRequired})`);

    try {
        const redisOptions = {
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
            connectTimeout: 10000,
            ...(isTlsRequired ? { tls: { rejectUnauthorized: false } } : {})
        };

        redisClient = new Redis(redisUrl, redisOptions);

        redisClient.on('connect', () => {
            console.log(`✅ Connected to Redis successfully [${isCloudEnv ? 'Cloud/Upstash Production' : 'Localhost Redis'}] [${maskedUrl}]`);
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


