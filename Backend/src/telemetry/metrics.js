/**
 * OpenTelemetry Application Metrics
 * Phase 4: GenAI, HTTP, ATS, and Cache Observability
 *
 * Defines low-cardinality OpenTelemetry metric instruments:
 * - HTTP server requests, duration, and error counts
 * - ATS match evaluation counts, duration, and failures
 * - LLM provider request counts, duration, failures, and token usage
 * - Redis cache hit and miss counters
 *
 * Strict Cardinality & Privacy Safeguards:
 * - NO user IDs, emails, resume IDs, job IDs, request IDs, or trace IDs in metric dimensions
 * - Stable metric names and semantic attribute conventions
 * - Non-fatal best-effort execution
 */

'use strict';

const { metrics } = require('@opentelemetry/api');

const meter = metrics.getMeter('kivi-backend', '1.0.0');

// ── 1. HTTP Server Metrics ───────────────────────────────────────────────────
const httpRequestCounter = meter.createCounter('http.server.requests', {
    description: 'Total number of HTTP server requests received',
    unit: '{requests}'
});

const httpRequestDuration = meter.createHistogram('http.server.request.duration', {
    description: 'Duration of HTTP server requests',
    unit: 'ms'
});

const httpErrorCounter = meter.createCounter('http.server.errors', {
    description: 'Total number of HTTP server errors (4xx/5xx)',
    unit: '{errors}'
});

// ── 2. ATS Match Evaluation Metrics ──────────────────────────────────────────
const atsAnalysisCounter = meter.createCounter('kivi.ats.analysis.count', {
    description: 'Total number of structured ATS match analyses executed',
    unit: '{analyses}'
});

const atsAnalysisDuration = meter.createHistogram('kivi.ats.analysis.duration', {
    description: 'Execution duration of structured ATS match scoring',
    unit: 'ms'
});

const atsFailureCounter = meter.createCounter('kivi.ats.failures', {
    description: 'Total number of ATS analysis failures',
    unit: '{failures}'
});

// ── 3. GenAI / LLM Metrics ───────────────────────────────────────────────────
const llmRequestCounter = meter.createCounter('gen_ai.client.requests', {
    description: 'Total number of requests made to GenAI LLM providers',
    unit: '{requests}'
});

const llmRequestDuration = meter.createHistogram('gen_ai.client.request.duration', {
    description: 'Duration of GenAI LLM provider requests',
    unit: 'ms'
});

const llmFailureCounter = meter.createCounter('gen_ai.client.failures', {
    description: 'Total number of failed GenAI LLM provider calls',
    unit: '{failures}'
});

const llmTokenUsageCounter = meter.createCounter('gen_ai.client.token.usage', {
    description: 'Total input and output tokens consumed across GenAI calls',
    unit: '{tokens}'
});

// ── 4. Redis Cache Metrics ───────────────────────────────────────────────────
const cacheHitCounter = meter.createCounter('kivi.cache.hits', {
    description: 'Total number of Redis cache hits',
    unit: '{hits}'
});

const cacheMissCounter = meter.createCounter('kivi.cache.misses', {
    description: 'Total number of Redis cache misses',
    unit: '{misses}'
});

// ── Helpers & Recording Functions ────────────────────────────────────────────

/**
 * Normalizes HTTP route paths to replace dynamic ObjectIDs, UUIDs, or numbers with ':id'
 * to avoid high-cardinality metric label explosions.
 */
function normalizeRoute(route) {
    if (!route || typeof route !== 'string') return '/';
    return route
        // MongoDB 24-char ObjectId
        .replace(/\/[a-f0-9]{24}(?=\/|$)/gi, '/:id')
        // UUIDs
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/:id')
        // Query string strip
        .replace(/\?.*$/, '')
        // Trailing slash normalize
        .replace(/\/+$/, '') || '/';
}

/**
 * Record an HTTP server request and its duration.
 */
function recordHttpRequest({ method = 'GET', route = '/', statusCode = 200, durationMs = 0, errorType = null }) {
    try {
        const cleanMethod = String(method).toUpperCase();
        const cleanRoute = normalizeRoute(route);
        const code = Number(statusCode) || 200;

        const attributes = {
            'http.method': cleanMethod,
            'http.route': cleanRoute,
            'http.status_code': code
        };

        httpRequestCounter.add(1, attributes);
        if (durationMs >= 0) {
            httpRequestDuration.record(durationMs, attributes);
        }

        if (code >= 400) {
            const errAttributes = {
                'http.method': cleanMethod,
                'http.route': cleanRoute,
                'http.status_code': code,
                'error.type': errorType || (code >= 500 ? 'server_error' : 'client_error')
            };
            httpErrorCounter.add(1, errAttributes);
        }
    } catch {
        // Telemetry is strictly best-effort
    }
}

/**
 * Express middleware for automatic low-cardinality HTTP request metrics.
 */
function httpMetricsMiddleware(req, res, next) {
    const startTime = Date.now();

    res.on('finish', () => {
        try {
            const durationMs = Date.now() - startTime;
            const route = req.baseUrl
                ? `${req.baseUrl}${req.route?.path || ''}`
                : (req.route?.path || req.path || '/');

            recordHttpRequest({
                method: req.method,
                route,
                statusCode: res.statusCode,
                durationMs
            });
        } catch {
            // Non-fatal
        }
    });

    next();
}

/**
 * Record ATS analysis metrics.
 */
function recordAtsAnalysis({ mode = 'deterministic', status = 'success', durationMs = 0, errorType = null }) {
    try {
        const attributes = {
            'kivi.processing.mode': mode,
            'status': status
        };

        atsAnalysisCounter.add(1, attributes);
        if (durationMs >= 0) {
            atsAnalysisDuration.record(durationMs, attributes);
        }

        if (status === 'error') {
            atsFailureCounter.add(1, {
                'kivi.processing.mode': mode,
                'error.type': errorType || 'Error'
            });
        }
    } catch {
        // Non-fatal
    }
}

/**
 * Record GenAI LLM provider call metrics.
 */
function recordLlmRequest({
    provider = 'unknown',
    model = 'unknown',
    operation = 'chat',
    status = 'success',
    durationMs = 0,
    errorType = null,
    inputTokens = undefined,
    outputTokens = undefined
}) {
    try {
        const baseAttributes = {
            'gen_ai.provider.name': provider,
            'gen_ai.request.model': model,
            'operation': operation,
            'status': status
        };

        llmRequestCounter.add(1, baseAttributes);
        if (durationMs >= 0) {
            llmRequestDuration.record(durationMs, baseAttributes);
        }

        if (status === 'error') {
            llmFailureCounter.add(1, {
                'gen_ai.provider.name': provider,
                'gen_ai.request.model': model,
                'error.type': errorType || 'Error'
            });
        }

        // Record tokens when reliably provided by SDK
        if (typeof inputTokens === 'number' && inputTokens >= 0) {
            llmTokenUsageCounter.add(inputTokens, {
                'gen_ai.provider.name': provider,
                'gen_ai.request.model': model,
                'token_type': 'input'
            });
        }
        if (typeof outputTokens === 'number' && outputTokens >= 0) {
            llmTokenUsageCounter.add(outputTokens, {
                'gen_ai.provider.name': provider,
                'gen_ai.request.model': model,
                'token_type': 'output'
            });
        }
    } catch {
        // Non-fatal
    }
}

/**
 * Record Redis cache hit or miss.
 */
function recordCacheAccess({ namespace = 'default', hit = false }) {
    try {
        const attributes = {
            'cache.namespace': namespace || 'default'
        };

        if (hit) {
            cacheHitCounter.add(1, attributes);
        } else {
            cacheMissCounter.add(1, attributes);
        }
    } catch {
        // Non-fatal
    }
}

module.exports = {
    // Instruments
    httpRequestCounter,
    httpRequestDuration,
    httpErrorCounter,
    atsAnalysisCounter,
    atsAnalysisDuration,
    atsFailureCounter,
    llmRequestCounter,
    llmRequestDuration,
    llmFailureCounter,
    llmTokenUsageCounter,
    cacheHitCounter,
    cacheMissCounter,

    // Recording helpers
    recordHttpRequest,
    httpMetricsMiddleware,
    recordAtsAnalysis,
    recordLlmRequest,
    recordCacheAccess,
    normalizeRoute
};

