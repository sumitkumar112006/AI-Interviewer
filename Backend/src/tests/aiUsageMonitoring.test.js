/**
 * aiUsageMonitoring.test.js — Automated Test Suite for IMPLEMENTATION 10 (AI Token and Cost Monitoring)
 */

'use strict';

const mongoose = require('mongoose');
const { calculateEstimatedCost, getModelPricing, MODEL_PRICING } = require('../config/aiPricing.config');
const aiUsageService = require('../services/aiUsage.service');
const AiUsage = require('../models/aiUsage.model');
const aiUsageController = require('../controller/aiUsage.controller');

describe('IMPLEMENTATION 10 — AI Token and Cost Monitoring Test Suite', () => {

    describe('1. Centrally Maintainable Model Pricing Configuration', () => {
        test('retrieves accurate pricing for Groq and Gemini models', () => {
            const groqPricing = getModelPricing('openai/gpt-oss-120b');
            expect(groqPricing.inputPerMillion).toBe(0.50);
            expect(groqPricing.outputPerMillion).toBe(0.80);

            const geminiPricing = getModelPricing('gemini-2.5-flash');
            expect(geminiPricing.inputPerMillion).toBe(0.075);
            expect(geminiPricing.outputPerMillion).toBe(0.30);
        });

        test('returns zero cost for free-tier open models', () => {
            const freePricing = getModelPricing('nvidia/nemotron-3-super-120b-a12b:free');
            expect(freePricing.inputPerMillion).toBe(0.0);
            expect(freePricing.outputPerMillion).toBe(0.0);

            const cost = calculateEstimatedCost('nvidia/nemotron-3-super-120b-a12b:free', 10000, 5000);
            expect(cost).toBe(0);
        });

        test('calculates accurate estimated cost separated from billed cost', () => {
            // 1,000 input tokens at $0.50/M = $0.0005
            // 500 output tokens at $0.80/M = $0.0004
            // Total = $0.0009
            const cost = calculateEstimatedCost('openai/gpt-oss-120b', 1000, 500);
            expect(cost).toBe(0.0009);
        });

        test('falls back gracefully for unknown models and zero tokens', () => {
            const fallback = getModelPricing('some-future-unknown-model');
            expect(fallback).toBeDefined();
            expect(fallback.inputPerMillion).toBeGreaterThan(0);

            expect(calculateEstimatedCost('openai/gpt-oss-120b', 0, 0)).toBe(0);
            expect(calculateEstimatedCost('openai/gpt-oss-120b', null, undefined)).toBe(0);
        });
    });

    describe('2. Async Context & Sanitized Usage Recording', () => {
        test('runWithAiContext propagates context across async boundaries', async () => {
            const testUserId = new mongoose.Types.ObjectId();
            await aiUsageService.runWithAiContext({
                feature: 'interview_report',
                userId: testUserId,
                jobId: 'job_test_123',
                attempt: 2
            }, async () => {
                const ctx = aiUsageService.getAiContext();
                expect(ctx.feature).toBe('interview_report');
                expect(ctx.userId).toBe(testUserId);
                expect(ctx.jobId).toBe('job_test_123');
                expect(ctx.attempt).toBe(2);
                expect(ctx.requestId).toBeDefined();
            });
        });

        test('sanitizeErrorMessage strips tokens, keys, and credentials', () => {
            const sensitiveError = new Error('HTTP 401 Unauthorized with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and key=AIzaSyD-Secret1234');
            const sanitized = aiUsageService.sanitizeErrorMessage(sensitiveError);

            expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
            expect(sanitized).not.toContain('AIzaSyD-Secret1234');
            expect(sanitized).toContain('[REDACTED]');
        });

        test('recordAiUsage handles providers that do not expose token counts without crashing', async () => {
            const doc = await aiUsageService.recordAiUsage({
                provider: 'openrouter',
                model: 'nvidia/nemotron-3-super-120b-a12b:free',
                feature: 'ai_assistant',
                tokenCountsAvailable: false,
                status: 'success',
                latencyMs: 420
            });

            // Since DB is not connected in this unit test mock, verify it returns null gracefully without throwing
            expect(doc).toBeNull();
        });
    });

    describe('3. Idempotency & Retry Deduplication', () => {
        test('deduplicates usage records when background jobs retry with the same idempotencyKey', async () => {
            const findOneAndUpdateSpy = jest.spyOn(AiUsage, 'findOneAndUpdate').mockImplementation(async (query, update, options) => {
                return {
                    _id: new mongoose.Types.ObjectId(),
                    ...update.$setOnInsert
                };
            });

            const originalReadyState = mongoose.connection.readyState;
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

            try {
                const testJobId = 'bull_job_999';
                const res1 = await aiUsageService.recordAiUsage({
                    provider: 'groq',
                    model: 'openai/gpt-oss-120b',
                    feature: 'resume_generation',
                    jobId: testJobId,
                    attempt: 1,
                    inputTokens: 1200,
                    outputTokens: 800,
                    status: 'success'
                });

                expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        idempotencyKey: expect.stringContaining(testJobId)
                    }),
                    expect.any(Object),
                    expect.objectContaining({ upsert: true })
                );
            } finally {
                Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
                findOneAndUpdateSpy.mockRestore();
            }
        });
    });

    describe('4. Aggregation Pipeline & Analytics Formatting', () => {
        test('getAiUsageAnalytics aggregates summary, provider, feature, and trend facets', async () => {
            const mockAggregationResult = [{
                summary: [{
                    totalRequests: 42,
                    successfulRequests: 40,
                    failedRequests: 2,
                    totalInputTokens: 84000,
                    totalOutputTokens: 28000,
                    totalTokens: 112000,
                    estimatedCostUsd: 0.0644,
                    avgLatencyMs: 850
                }],
                byProvider: [
                    {
                        _id: { provider: 'groq', model: 'openai/gpt-oss-120b' },
                        requests: 30,
                        failedRequests: 1,
                        totalTokens: 80000,
                        inputTokens: 60000,
                        outputTokens: 20000,
                        estimatedCostUsd: 0.046,
                        avgLatencyMs: 650
                    }
                ],
                byFeature: [
                    {
                        _id: 'resume_generation',
                        requests: 25,
                        failedRequests: 1,
                        totalTokens: 60000,
                        estimatedCostUsd: 0.035,
                        avgLatencyMs: 900
                    }
                ],
                dailyTrends: [
                    {
                        _id: '2026-11-08',
                        requests: 42,
                        failedRequests: 2,
                        totalTokens: 112000,
                        estimatedCostUsd: 0.0644,
                        avgLatencyMs: 850
                    }
                ],
                monthlyTrends: [
                    {
                        _id: '2026-11',
                        requests: 42,
                        totalTokens: 112000,
                        estimatedCostUsd: 0.0644
                    }
                ]
            }];

            const aggregateSpy = jest.spyOn(AiUsage, 'aggregate').mockResolvedValue(mockAggregationResult);

            try {
                const analytics = await aiUsageService.getAiUsageAnalytics({ refresh: true });

                expect(analytics.summary.totalRequests).toBe(42);
                expect(analytics.summary.successfulRequests).toBe(40);
                expect(analytics.summary.failedRequests).toBe(2);
                expect(analytics.summary.totalTokens).toBe(112000);
                expect(analytics.summary.estimatedCostUsd).toBe(0.0644);
                expect(analytics.summary.avgLatencyMs).toBe(850);

                expect(analytics.byProvider.length).toBe(1);
                expect(analytics.byProvider[0].model).toBe('openai/gpt-oss-120b');

                expect(analytics.byFeature.length).toBe(1);
                expect(analytics.byFeature[0].feature).toBe('resume_generation');

                expect(analytics.dailyTrends.length).toBe(1);
                expect(analytics.dailyTrends[0].date).toBe('2026-11-08');
            } finally {
                aggregateSpy.mockRestore();
            }
        });
    });

    describe('5. Controller Handler Responses', () => {
        test('getAiUsageSummaryController returns 200 with formatted telemetry', async () => {
            const getAnalyticsSpy = jest.spyOn(aiUsageService, 'getAiUsageAnalytics').mockResolvedValue({
                summary: { totalRequests: 10, totalTokens: 20000, estimatedCostUsd: 0.015 },
                byProvider: [],
                byFeature: [],
                dailyTrends: [],
                monthlyTrends: []
            });

            const req = {
                query: { refresh: 'true' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            try {
                await aiUsageController.getAiUsageSummaryController(req, res);
                expect(res.status).toHaveBeenCalledWith(200);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    success: true,
                    summary: expect.objectContaining({ totalRequests: 10 })
                }));
            } finally {
                getAnalyticsSpy.mockRestore();
            }
        });

        test('getAiUsageLogsController returns 200 with paginated logs', async () => {
            const getLogsSpy = jest.spyOn(aiUsageService, 'getAiUsageLogs').mockResolvedValue({
                logs: [{ _id: '1', provider: 'groq', model: 'openai/gpt-oss-120b', totalTokens: 1500, status: 'success' }],
                pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
            });

            const req = {
                query: { page: '1', limit: '20' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            try {
                await aiUsageController.getAiUsageLogsController(req, res);
                expect(res.status).toHaveBeenCalledWith(200);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    success: true,
                    logs: expect.any(Array),
                    pagination: expect.objectContaining({ total: 1 })
                }));
            } finally {
                getLogsSpy.mockRestore();
            }
        });
    });
});

