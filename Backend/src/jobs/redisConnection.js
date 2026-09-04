const Redis = require('ioredis');

function getRedisConnectionUrl() {
    const isProduction = process.env.NODE_ENV === 'production';
    const isRailwayEnv = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL || process.env.REDISHOST || isProduction);

    let redisUrl = null;

    if (isRailwayEnv) {
        if (process.env.REDISHOST) {
            const user = process.env.REDISUSER || 'default';
            const pass = process.env.REDISPASSWORD ? `:${process.env.REDISPASSWORD}@` : '';
            const host = process.env.REDISHOST;
            const port = process.env.REDISPORT || 6379;
            redisUrl = `redis://${user}${pass}${host}:${port}`;
        } else if (process.env.REDIS_URL && !process.env.REDIS_URL.includes('127.0.0.1') && !process.env.REDIS_URL.includes('localhost')) {
            redisUrl = process.env.REDIS_URL;
        } else if (process.env.REDIS_PUBLIC_URL) {
            redisUrl = process.env.REDIS_PUBLIC_URL;
        }
    }

    if (!redisUrl) {
        redisUrl = process.env.LOCAL_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    }

    return redisUrl;
}

function createBullRedisConnection() {
    const redisUrl = getRedisConnectionUrl();
    return new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        connectTimeout: 10000,
        retryStrategy(times) {
            return Math.min(times * 500, 3000);
        }
    });
}

module.exports = { getRedisConnectionUrl, createBullRedisConnection };
