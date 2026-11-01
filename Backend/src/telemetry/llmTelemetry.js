/**
 * Reusable LLM Telemetry Abstraction
 * Phase 4: Gemini & Groq GenAI Observability
 *
 * Implements OpenTelemetry GenAI semantic conventions:
 * - Provider identity: 'gcp.gemini' for Google Gemini, 'groq' for Groq
 * - Semantic attributes: gen_ai.provider.name, gen_ai.request.model, gen_ai.operation.name
 * - Response metadata: gen_ai.response.model, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens
 * - Latency & Failure handling: span timing, recordException, SpanStatusCode.ERROR
 * - Integrates with Application Metrics (gen_ai.client.requests, duration, failures, token usage)
 * - Strict Privacy: ZERO prompt, completion, PII, or credential capture
 */

'use strict';

const { trace, SpanStatusCode } = require('@opentelemetry/api');
const { recordLlmRequest } = require('./metrics');

const tracer = trace.getTracer('kivi-backend');

/**
 * Executes an LLM provider call inside an active OpenTelemetry span and records GenAI metrics.
 *
 * @param {Object} options
 * @param {'gcp.gemini' | 'groq'} options.provider - LLM provider identifier
 * @param {string} options.model - Request model name
 * @param {string} [options.operation='chat'] - GenAI operation name ('chat' | 'generate_content')
 * @param {Function} options.execute - async (span) => rawResponse
 * @returns {Promise<any>} The unmodified response from execute
 */
async function instrumentLLMCall({
    provider,
    model,
    operation = 'chat',
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
                // 1. Groq / OpenAI-compatible response shape
                if (result.usage && typeof result.usage === 'object') {
                    if (typeof result.usage.prompt_tokens === 'number') {
                        inputTokens = result.usage.prompt_tokens;
                        span.setAttribute('gen_ai.usage.input_tokens', inputTokens);
                    }
                    if (typeof result.usage.completion_tokens === 'number') {
                        outputTokens = result.usage.completion_tokens;
                        span.setAttribute('gen_ai.usage.output_tokens', outputTokens);
                    }
                }
                if (typeof result.model === 'string' && result.model) {
                    responseModel = result.model;
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

            // Record successful LLM metrics
            recordLlmRequest({
                provider,
                model,
                operation,
                status: 'success',
                durationMs,
                inputTokens,
                outputTokens
            });

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

