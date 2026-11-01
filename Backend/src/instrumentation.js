/**
 * OpenTelemetry Core Node SDK Initialization
 * Phase 2: Core Infrastructure
 *
 * Implements:
 * - OpenTelemetry NodeSDK initialization
 * - Standard Resource configuration (service.name = kivi-backend, service.version, deployment.environment)
 * - OTLP HTTP trace & metrics exporters (environment-configurable)
 * - Configurable sampling (OTEL_TRACES_SAMPLER, OTEL_TRACES_SAMPLER_ARG)
 * - W3C TraceContext & Baggage context propagation
 * - Targeted Node.js auto-instrumentation (HTTP, Express, Mongoose, IORedis, Undici)
 * - Strict security/PII filters (no bodies, no credentials, no headers)
 * - Best-effort resilient failure handling (telemetry outages never crash the service)
 */

'use strict';

const path = require('path');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const {
    AlwaysOnSampler,
    AlwaysOffSampler,
    ParentBasedSampler,
    TraceIdRatioBasedSampler
} = require('@opentelemetry/sdk-trace');
const {
    W3CTraceContextPropagator,
    W3CBaggagePropagator,
    CompositePropagator
} = require('@opentelemetry/core');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

// 1. Check if OpenTelemetry is explicitly disabled
if (process.env.OTEL_SDK_DISABLED === 'true') {
    console.log('[OpenTelemetry] OTEL_SDK_DISABLED is set to true. Telemetry is disabled.');
    module.exports = { sdk: null, isEnabled: false };
    return;
}

// 2. Resolve Service identity and version from package.json
let serviceVersion = '1.0.0';
try {
    const pkg = require(path.join(__dirname, '../package.json'));
    if (pkg && pkg.version) {
        serviceVersion = pkg.version;
    }
} catch {
    // Fallback if package.json cannot be read
}

const serviceName = process.env.OTEL_SERVICE_NAME || 'kivi-backend';
const environment = process.env.NODE_ENV || 'development';

// 3. Construct Standard Resource
const resource = resourceFromAttributes({
    'service.name': serviceName,
    'service.version': serviceVersion,
    'deployment.environment.name': environment,
    'deployment.environment': environment
});

// 4. Configure Sampling Strategy
function resolveSampler() {
    const samplerType = (process.env.OTEL_TRACES_SAMPLER || 'parentbased_always_on').toLowerCase().trim();
    const parsedArg = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0');
    const ratio = isNaN(parsedArg) ? 1.0 : Math.min(Math.max(parsedArg, 0), 1);

    switch (samplerType) {
        case 'always_on':
            return new AlwaysOnSampler();
        case 'always_off':
            return new AlwaysOffSampler();
        case 'traceidratio':
            return new TraceIdRatioBasedSampler(ratio);
        case 'parentbased_always_off':
            return new ParentBasedSampler({ root: new AlwaysOffSampler() });
        case 'parentbased_traceidratio':
            return new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(ratio) });
        case 'parentbased_always_on':
        default:
            return new ParentBasedSampler({ root: new AlwaysOnSampler() });
    }
}

const sampler = resolveSampler();

// 5. Configure Context Propagator (W3C TraceContext + W3C Baggage)
const textMapPropagator = new CompositePropagator({
    propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator()
    ]
});

// 6. Configure Trace Exporter (OTLP HTTP)
// If OTEL_TRACES_EXPORTER === 'none', skip trace exporter
let traceExporter = undefined;
if (process.env.OTEL_TRACES_EXPORTER !== 'none') {
    try {
        traceExporter = new OTLPTraceExporter();
    } catch (expErr) {
        console.warn('[OpenTelemetry] Failed to initialize OTLPTraceExporter:', expErr.message);
    }
}

// 7. Configure Metrics Exporter (Optional / opt-in via OTEL_METRICS_EXPORTER)
let metricReader = undefined;
if (process.env.OTEL_METRICS_EXPORTER === 'otlp') {
    try {
        const metricExporter = new OTLPMetricExporter();
        const exportInterval = parseInt(process.env.OTEL_METRIC_EXPORT_INTERVAL || '60000', 10);
        metricReader = new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: exportInterval
        });
    } catch (metricErr) {
        console.warn('[OpenTelemetry] Failed to initialize OTLPMetricExporter:', metricErr.message);
    }
}

// 8. Configure Logs Exporter (OTLP HTTP for Grafana Cloud / Loki)
// If OTEL_LOGS_EXPORTER === 'none', skip log export
const logRecordProcessors = [];
if (process.env.OTEL_LOGS_EXPORTER !== 'none') {
    try {
        const logExporter = new OTLPLogExporter();
        logRecordProcessors.push(new BatchLogRecordProcessor(logExporter));
    } catch (logErr) {
        console.warn('[OpenTelemetry] Failed to initialize OTLPLogExporter:', logErr.message);
    }
}

// 9. Configure Auto-Instrumentations with Strict Security / PII Controls
const instrumentations = getNodeAutoInstrumentations({
    // Disable noisy or irrelevant instrumentations
    '@opentelemetry/instrumentation-fs': { enabled: false },
    '@opentelemetry/instrumentation-dns': { enabled: false },
    '@opentelemetry/instrumentation-net': { enabled: false },
    '@opentelemetry/instrumentation-graphql': { enabled: false },
    '@opentelemetry/instrumentation-grpc': { enabled: false },
    '@opentelemetry/instrumentation-kafkajs': { enabled: false },
    '@opentelemetry/instrumentation-mysql': { enabled: false },
    '@opentelemetry/instrumentation-mysql2': { enabled: false },
    '@opentelemetry/instrumentation-pg': { enabled: false },

    // HTTP Instrumentation with Privacy & Healthcheck Filters
    '@opentelemetry/instrumentation-http': {
        enabled: true,
        // Suppress keep-alive healthchecks and keep telemetry clean
        ignoreIncomingRequestHook: (req) => {
            const url = req.url || '';
            return url === '/health' || url === '/';
        },
        // Never capture sensitive headers or bodies
        headersToSpanAttributes: {
            server: {
                requestHeaders: ['user-agent', 'content-type'],
                responseHeaders: ['content-type']
            },
            client: {
                requestHeaders: ['content-type'],
                responseHeaders: ['content-type']
            }
        }
    },

    // Express Framework Instrumentation
    '@opentelemetry/instrumentation-express': {
        enabled: true
    },

    // MongoDB / Mongoose Instrumentation
    '@opentelemetry/instrumentation-mongoose': {
        enabled: true
    },
    '@opentelemetry/instrumentation-mongodb': {
        enabled: true,
        // Do not record raw query parameters in database statement to prevent PII leaks
        enhancedDatabaseReporting: false
    },

    // IORedis Cache & Rate Limiting Instrumentation
    '@opentelemetry/instrumentation-ioredis': {
        enabled: true
    },

    // Undici / Native Fetch Instrumentation (used by modern Node / HTTP client calls)
    '@opentelemetry/instrumentation-undici': {
        enabled: true
    }
});

// 10. Instantiate NodeSDK
let sdk = null;
try {
    sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader,
        logRecordProcessors: logRecordProcessors.length > 0 ? logRecordProcessors : undefined,
        sampler,
        textMapPropagator,
        instrumentations
    });

    sdk.start();
    const samplerDesc = sampler.toString ? sampler.toString() : (process.env.OTEL_TRACES_SAMPLER || 'parentbased_always_on');
    console.log(`[OpenTelemetry] Core SDK initialized [service: ${serviceName}, env: ${environment}, version: ${serviceVersion}, sampler: ${samplerDesc}]`);
} catch (sdkErr) {
    console.error('[OpenTelemetry] Initialization error (service will continue without telemetry):', sdkErr.message);
    sdk = null;
}

// 11. Graceful shutdown handler
function shutdownTelemetry() {
    if (sdk) {
        sdk.shutdown()
            .then(() => console.log('[OpenTelemetry] SDK cleanly shutdown.'))
            .catch((err) => console.warn('[OpenTelemetry] Error shutting down SDK:', err.message));
    }
}

process.once('SIGTERM', shutdownTelemetry);
process.once('SIGINT', shutdownTelemetry);

module.exports = {
    sdk,
    isEnabled: !!sdk
};

