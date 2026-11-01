/**
 * OpenTelemetry Structured Logging & Trace Correlation
 * Phase 5: Structured Logging Layer
 *
 * Implements:
 * - Application-level structured logger (debug, info, warn, error)
 * - Automatic active trace_id and span_id correlation
 * - Dual emission: OpenTelemetry LogRecord (for OTLP / Grafana Cloud / Loki) + human-friendly console
 * - Strict privacy sanitization: redacts passwords, tokens, API keys, prompts, completions, resume/JD text
 * - Cardinality protection: no trace_ids or user identifiers used as metric dimensions
 * - Complete non-fatal resilience: logging errors never crash or disrupt application flow
 */

'use strict';

const { logs, SeverityNumber, trace } = require('@opentelemetry/api');

// ── 1. Severity Configuration ────────────────────────────────────────────────
const LOG_LEVELS = {
    debug: { priority: 10, severityNumber: SeverityNumber.DEBUG, severityText: 'DEBUG', consoleMethod: 'debug' },
    info:  { priority: 20, severityNumber: SeverityNumber.INFO,  severityText: 'INFO',  consoleMethod: 'log' },
    warn:  { priority: 30, severityNumber: SeverityNumber.WARN,  severityText: 'WARN',  consoleMethod: 'warn' },
    error: { priority: 40, severityNumber: SeverityNumber.ERROR, severityText: 'ERROR', consoleMethod: 'error' }
};

function getCurrentMinPriority() {
    const envLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')).toLowerCase().trim();
    return LOG_LEVELS[envLevel]?.priority || LOG_LEVELS.info.priority;
}

// ── 2. Sensitive Data & PII Scrubbing ─────────────────────────────────────────
const SENSITIVE_KEY_REGEX = /(password|token|jwt|secret|auth|authorization|cookie|key|apikey|api_key|geminikey|groqkey|razorpay|prompt|completion|resume|jd|jobdescription|bio|email|phone|phonenumber|mobile|contact|ssn|creditcard)/i;
const MAX_STRING_LENGTH = 500;
const MAX_DEPTH = 4;

/**
 * Recursively scrubs objects and arrays of secrets and oversized strings.
 */
function sanitizeMetadata(data, depth = 0) {
    if (data === null || data === undefined) return data;
    if (depth > MAX_DEPTH) return '[MaxDepthExceeded]';

    if (data instanceof Error) {
        return {
            name: data.name,
            message: data.message,
            stack: data.stack ? data.stack.slice(0, 1000) : undefined
        };
    }

    if (typeof data === 'string') {
        if (data.length > MAX_STRING_LENGTH) {
            return `${data.slice(0, MAX_STRING_LENGTH)}… [TRUNCATED]`;
        }
        return data;
    }

    if (typeof data !== 'object') {
        return data;
    }

    if (Array.isArray(data)) {
        return data.slice(0, 20).map(item => sanitizeMetadata(item, depth + 1));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (SENSITIVE_KEY_REGEX.test(key)) {
            sanitized[key] = '[REDACTED]';
        } else {
            sanitized[key] = sanitizeMetadata(value, depth + 1);
        }
    }
    return sanitized;
}

// ── 3. Trace Context Correlation Helper ──────────────────────────────────────
/**
 * Extracts active trace_id and span_id if an active span is in progress.
 */
function getActiveTraceContext() {
    try {
        const activeSpan = trace.getActiveSpan();
        if (activeSpan) {
            const ctx = activeSpan.spanContext();
            if (trace.isSpanContextValid(ctx)) {
                return {
                    traceId: ctx.traceId,
                    spanId: ctx.spanId,
                    traceFlags: ctx.traceFlags
                };
            }
        }
    } catch {
        // Non-fatal
    }
    return null;
}

// ── 4. Core Logger Implementation ────────────────────────────────────────────
class KiviLogger {
    constructor() {
        this.serviceName = process.env.OTEL_SERVICE_NAME || 'kivi-backend';
    }

    _getOtelLogger() {
        try {
            return logs.getLogger('kivi-backend', '1.0.0');
        } catch {
            return null;
        }
    }

    log(levelName, message, meta = {}) {
        const levelConfig = LOG_LEVELS[levelName] || LOG_LEVELS.info;
        const minPriority = getCurrentMinPriority();

        // Level threshold check
        if (levelConfig.priority < minPriority) {
            return;
        }

        const timestamp = new Date().toISOString();
        const traceContext = getActiveTraceContext();
        const sanitizedMeta = typeof meta === 'object' && meta !== null
            ? sanitizeMetadata(meta)
            : { value: sanitizeMetadata(meta) };

        // 1. Emit OpenTelemetry LogRecord (for OTLP Export to Grafana/Loki)
        try {
            const otelLogger = this._getOtelLogger();
            if (otelLogger && process.env.OTEL_SDK_DISABLED !== 'true') {
                const logAttributes = {
                    'log.level': levelConfig.severityText,
                    'service.name': this.serviceName
                };

                // Add sanitized attributes (flatten simple types, stringify objects)
                for (const [k, v] of Object.entries(sanitizedMeta)) {
                    if (v !== undefined && v !== null) {
                        logAttributes[k] = (typeof v === 'object') ? JSON.stringify(v) : v;
                    }
                }

                otelLogger.emit({
                    severityNumber: levelConfig.severityNumber,
                    severityText: levelConfig.severityText,
                    body: typeof message === 'string' ? message : JSON.stringify(sanitizeMetadata(message)),
                    attributes: logAttributes
                });
            }
        } catch {
            // Telemetry failure is strictly non-fatal
        }

        // 2. Format and output to local console for development & container stdout
        try {
            const correlationTag = traceContext
                ? `[trace_id=${traceContext.traceId} span_id=${traceContext.spanId}] `
                : '';

            const metaStr = Object.keys(sanitizedMeta).length > 0
                ? ` ${JSON.stringify(sanitizedMeta)}`
                : '';

            const consoleFn = console[levelConfig.consoleMethod] || console.log;
            consoleFn(`[${timestamp}] [${levelConfig.severityText}] ${correlationTag}${message}${metaStr}`);
        } catch {
            // Non-fatal fallback
        }
    }

    debug(message, meta) {
        this.log('debug', message, meta);
    }

    info(message, meta) {
        this.log('info', message, meta);
    }

    warn(message, meta) {
        this.log('warn', message, meta);
    }

    error(message, meta) {
        this.log('error', message, meta);
    }
}

const logger = new KiviLogger();

module.exports = {
    logger,
    KiviLogger,
    sanitizeMetadata,
    getActiveTraceContext
};

