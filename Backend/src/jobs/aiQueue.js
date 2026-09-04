const { Queue } = require('bullmq');
const { createBullRedisConnection } = require('./redisConnection');

const queueConnection = createBullRedisConnection();

const aiQueue = new Queue('ai-generation', {
    connection: queueConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 3000
        },
        removeOnComplete: {
            age: 86400, // keep for 24 hours
            count: 1000
        },
        removeOnFail: {
            age: 86400 * 3, // keep failures for 3 days
            count: 2000
        }
    }
});

/**
 * Helper to add an AI job to the BullMQ queue
 * @param {string} type - job type name
 * @param {object} data - payload containing jobId and metadata
 */
async function enqueueAiJob(type, data = {}) {
    return await aiQueue.add(type, data, {
        jobId: data.jobId?.toString()
    });
}

module.exports = {
    aiQueue,
    enqueueAiJob
};
