/**
 * In-Memory Redis Command Monitor for KIVI-AI
 *
 * Lightweight, zero-overhead command tracker that maintains in-memory counters
 * to monitor Redis operation consumption WITHOUT generating any Redis network traffic.
 *
 * Strictly adheres to PII rules: never logs or stores tokens, passwords, or user payload data.
 */

const { logger } = require('./logger');

class RedisCommandMonitor {
    constructor() {
        this.startedAt = Date.now();
        this.totalCommands = 0;
        this.byOperation = new Map();
        this.bySource = new Map();
        this.hourlyWindow = []; // { timestamp, count }
        this.logInterval = null;
    }

    /**
     * Record a Redis command execution in memory
     * @param {string} operation - e.g. 'INCR', 'GET', 'SET', 'DEL', 'EXISTS', 'BLMOVE'
     * @param {string} source - e.g. 'ratelimit:global', 'auth:blacklist', 'cache:report'
     */
    record(operation = 'UNKNOWN', source = 'general') {
        this.totalCommands++;

        const opKey = String(operation).toUpperCase();
        this.byOperation.set(opKey, (this.byOperation.get(opKey) || 0) + 1);

        const srcKey = String(source).toLowerCase();
        this.bySource.set(srcKey, (this.bySource.get(srcKey) || 0) + 1);
    }

    /**
     * Get a snapshot of in-memory command metrics
     */
    getMetrics() {
        const uptimeMinutes = Math.max(1, Math.round((Date.now() - this.startedAt) / 60000));
        const ops = {};
        for (const [k, v] of this.byOperation.entries()) {
            ops[k] = v;
        }

        const sources = {};
        for (const [k, v] of this.bySource.entries()) {
            sources[k] = v;
        }

        return {
            totalCommands: this.totalCommands,
            uptimeMinutes,
            commandsPerMinute: +(this.totalCommands / uptimeMinutes).toFixed(2),
            estimatedMonthlyRunRate: Math.round((this.totalCommands / uptimeMinutes) * 60 * 24 * 30),
            byOperation: ops,
            bySource: sources,
            startedAt: new Date(this.startedAt).toISOString()
        };
    }

    /**
     * Reset counters (used in testing or periodic rollover)
     */
    reset() {
        this.startedAt = Date.now();
        this.totalCommands = 0;
        this.byOperation.clear();
        this.bySource.clear();
    }

    /**
     * Start periodic in-memory summary logger (logs every 15 minutes, 0 Redis traffic)
     */
    startPeriodicLogging(intervalMs = 15 * 60 * 1000) {
        if (this.logInterval || process.env.NODE_ENV === 'test') return;

        this.logInterval = setInterval(() => {
            const metrics = this.getMetrics();
            if (metrics.totalCommands > 0) {
                logger.info('[RedisMonitor] Periodic In-Memory Summary', {
                    total: metrics.totalCommands,
                    ratePerMin: metrics.commandsPerMinute,
                    monthlyEstimate: metrics.estimatedMonthlyRunRate,
                    ops: metrics.byOperation,
                    sources: metrics.bySource
                });
            }
        }, intervalMs);

        if (this.logInterval.unref) {
            this.logInterval.unref(); // Don't prevent process exit
        }
    }

    stopPeriodicLogging() {
        if (this.logInterval) {
            clearInterval(this.logInterval);
            this.logInterval = null;
        }
    }
}

const redisMonitor = new RedisCommandMonitor();

module.exports = {
    redisMonitor,
    recordRedisCommand: (op, src) => redisMonitor.record(op, src)
};

