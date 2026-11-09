/**
 * Reusable LLM Telemetry Abstraction
 * Phase 4: Gemini & Groq GenAI Observability + Centralized AI Token and Cost Tracking
 *
 * Implements OpenTelemetry GenAI semantic conventions:
 * - Provider identity: 'gcp.gemini' for Google Gemini, 'groq' for Groq, 'openrouter' for OpenRouter
 * - Semantic attributes: gen_ai.provider.name, gen_ai.request.model, gen_ai.operation.name
 * - Response metadata: gen_ai.response.model, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens
 * - Latency & Failure handling: span timing, recordException, SpanStatusCode.ERROR
 * - Integrates with Application Metrics (gen_ai.client.requests, duration, failures, token usage)
 * - Integrates with Centralized AI Usage & Cost Collection (AiUsage)
 * - Strict Privacy: ZERO prompt, completion, PII, or credential capture
 */

'use strict';

const { trace, SpanStatusCode } = require('@opentelemetry/api');
const { recordLlmRequest } = require('./metrics');
const { recordAiUsage } = require('../services/aiUsage.service');

const tracer = trace.getTracer('kivi-backend');

/**
 * Executes an LLM provider call inside an active OpenTelemetry span and records GenAI metrics & usage.
 *
 * @param {Object} options
 * @param {'gcp.gemini' | 'groq' | 'openrouter' | string} options.provider - LLM provider identifier
 * @param {string} options.model - Request model name
 * @param {string} [options.operation='chat'] - GenAI operation name ('chat' | 'generate_content')
 * @param {string} [options.feature] - Feature context ('resume_generation' | 'interview_report' | etc.)
 * @param {string} [options.userId] - Optional user identifier
 * @param {string} [options.requestId] - Optional request tracking ID
 * @param {string} [options.jobId] - Optional BullMQ background job ID
 * @param {number} [options.attempt] - Optional attempt counter
 * @param {Function} options.execute - async (span) => rawResponse
 * @returns {Promise<any>} The unmodified response from execute
 */
async function instrumentLLMCall({
    provider,
    model,
    operation = 'chat',
    feature,
    userId,
    requestId,
    jobId,
    attempt,
    execute
}) {
    const spanName = `${operation} ${model || provider}`;
    const startTime = Date.now();

    return tracer.startActiveSpan(spanName, {
        attributes: {
            'gen_ai.provider.name': provider,
            'gen_ai.request.model': model || 'unknown',
            'gen_ai.operation.name': operation
        }
    }, async (span) => {
        let inputTokens = undefined;
        let outputTokens = undefined;
        let responseModel = undefined;

        try {
            const result = await execute(span);
            const durationMs = Date.now() - startTime;

            // Extract genuine token counts and model info without guessing or estimating
            if (result && typeof result === 'object') {
                // 1. Groq / OpenAI-compatible / OpenRouter direct response shape
                const usageObj = result.usage || result.data?.usage;
                if (usageObj && typeof usageObj === 'object') {
                    if (typeof usageObj.prompt_tokens === 'number') {
                        inputTokens = usageObj.prompt_tokens;
                        span.setAttribute('gen_ai.usage.input_tokens', inputTokens);
                    }
                    if (typeof usageObj.completion_tokens === 'number') {
                        outputTokens = usageObj.completion_tokens;
                        span.setAttribute('gen_ai.usage.output_tokens', outputTokens);
                    }
                }
                const modelStr = result.model || result.data?.model;
                if (typeof modelStr === 'string' && modelStr) {
                    responseModel = modelStr;
                    span.setAttribute('gen_ai.response.model', responseModel);
                }

                // 2. Google GenAI response shape (@google/genai)
                if (result.usageMetadata && typeof result.usageMetadata === 'object') {
                    if (typeof result.usageMetadata.promptTokenCount === 'number') {
                        inputTokens = result.usageMetadata.promptTokenCount;
                        span.setAttribute('gen_ai.usage.input_tokens', inputTokens);
                    }
                    if (typeof result.usageMetadata.candidatesTokenCount === 'number') {
                        outputTokens = result.usageMetadata.candidatesTokenCount;
                        span.setAttribute('gen_ai.usage.output_tokens', outputTokens);
                    }
                }
                if (typeof result.modelVersion === 'string' && result.modelVersion) {
                    responseModel = result.modelVersion;
                    span.setAttribute('gen_ai.response.model', responseModel);
                }
            }

            span.setStatus({ code: SpanStatusCode.OK });

            // Record successful OpenTelemetry metrics
            recordLlmRequest({
                provider,
                model,
                operation,
                status: 'success',
                durationMs,
                inputTokens,
                outputTokens
            });

            // Record persistent AI usage & cost tracking (idempotent, safe, privacy-compliant)
            const tokenCountsAvailable = typeof inputTokens === 'number' || typeof outputTokens === 'number';
            recordAiUsage({
                provider,
                model: responseModel || model,
                feature,
                userId,
                requestId,
                jobId,
                attempt,
                inputTokens: typeof inputTokens === 'number' ? inputTokens : 0,
                outputTokens: typeof outputTokens === 'number' ? outputTokens : 0,
                totalTokens: (typeof inputTokens === 'number' ? inputTokens : 0) + (typeof outputTokens === 'number' ? outputTokens : 0),
                tokenCountsAvailable,
                status: 'success',
                latencyMs: durationMs
            }).catch(() => {});

            return result;
        } catch (err) {
            const durationMs = Date.now() - startTime;
            span.recordException(err);
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: err?.message || 'LLM provider request failed'
            });

            const errorType = err?.status ? String(err.status) : (err?.name || 'Error');
            span.setAttribute('error.type', errorType);

            // Record failed LLM metrics
            recordLlmRequest({
                provider,
                model,
                operation,
                status: 'error',
                durationMs,
                errorType
            });

            // Record failed persistent AI usage entry (tracks failed requests separately)
            recordAiUsage({
                provider,
                model: model || 'unknown',
                feature,
                userId,
                requestId,
                jobId,
                attempt,
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                tokenCountsAvailable: false,
                status: 'failed',
                errorMessage: err?.message || 'Provider execution failure',
                latencyMs: durationMs
            }).catch(() => {});

            // Preserve existing thrown error and retry/failover flow
            throw err;
        } finally {
            span.end();
        }
    });
}

module.exports = {
    instrumentLLMCall
};
