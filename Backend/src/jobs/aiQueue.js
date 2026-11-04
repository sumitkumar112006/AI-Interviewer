const { Queue } = require('bullmq');
const { trace, context, propagation, SpanKind, SpanStatusCode } = require('@opentelemetry/api');
const { createBullRedisConnection } = require('./redisConnection');

const tracer = trace.getTracer('kivi-backend');
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
 * Helper to add an AI job to the BullMQ queue with W3C trace context propagation
 * @param {string} type - job type name
 * @param {object} data - payload containing jobId and metadata
 */
async function enqueueAiJob(type, data = {}) {
    return tracer.startActiveSpan(`BullMQ producer ${type}`, {
        kind: SpanKind.PRODUCER,
        attributes: {
            'messaging.system': 'bullmq',
            'messaging.destination': 'ai-generation',
            'messaging.destination_kind': 'queue',
            'messaging.operation': 'publish',
            'kivi.job.type': type || 'unknown'
        }
    }, async (producerSpan) => {
        try {
            // Inject W3C TraceContext into dedicated metadata field
            const otelTraceContext = {};
            try {
                propagation.inject(context.active(), otelTraceContext);
            } catch {
                // Non-fatal if context injection fails
            }

            const payload = {
                ...data,
                otelTraceContext
            };

            const result = await aiQueue.add(type, payload, {
                jobId: data.jobId?.toString()
            });

            producerSpan.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (err) {
            producerSpan.recordException(err);
            producerSpan.setStatus({ code: SpanStatusCode.ERROR, message: err?.message || 'Failed to enqueue AI job' });
            throw err;
        } finally {
            producerSpan.end();
        }
    });
}

async function closeAiQueue() {
    try {
        if (aiQueue) {
            await aiQueue.close();
        }
    } finally {
        if (queueConnection) {
            try {
                await queueConnection.quit();
            } catch {
                queueConnection.disconnect();
            }
        }
    }
}

module.exports = {
    aiQueue,
    enqueueAiJob,
    closeAiQueue
};
