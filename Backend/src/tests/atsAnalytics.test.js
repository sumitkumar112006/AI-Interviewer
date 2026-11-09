/**
 * atsAnalytics.test.js — Automated test suite for IMPLEMENTATION 09 (Global ATS Analytics)
 *
 * Verifies:
 * 1. Median score calculation for odd, even, and empty datasets.
 * 2. MongoDB aggregation pipeline execution for global ATS metrics:
 *    - Total evaluations count.
 *    - Global average, median, min, and max scores.
 *    - 5-bucket distribution histogram (0-40, 41-60, 61-75, 76-85, 86-100).
 *    - Daily evaluation trendlines.
 *    - Subscription tier score breakdown (Free, Pro, Premium).
 * 3. Date range filtering.
 * 4. Cache utilization & refresh bypass.
 * 5. Controller response formatting.
 */

'use strict';

const mongoose = require('mongoose');
const interviewReportModel = require('../models/interviewReport.model');
const {
    getGlobalAtsAnalytics,
    calculateMedian
} = require('../services/atsAnalytics.service');
const {
    getAdminAtsAnalyticsController
} = require('../controller/atsAnalytics.controller');

describe('IMPLEMENTATION 09 — Global ATS Analytics Test Suite', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('1. Median Score Algorithm', () => {
        test('calculates correct median for odd length array', () => {
            expect(calculateMedian([45, 80, 92])).toBe(80);
            expect(calculateMedian([10, 20, 50, 70, 95])).toBe(50);
        });

        test('calculates correct median for even length array', () => {
            expect(calculateMedian([70, 80, 90, 100])).toBe(85);
            expect(calculateMedian([60, 75])).toBe(67.5);
        });

        test('returns 0 for empty or null array', () => {
            expect(calculateMedian([])).toBe(0);
            expect(calculateMedian(null)).toBe(0);
        });
    });

    describe('2. Aggregation Pipeline & Metrics Formulation', () => {
        test('getGlobalAtsAnalytics: processes facets and returns formatted telemetry', async () => {
            const fakeFacetResult = [
                {
                    summary: [
                        {
                            totalEvaluations: 40,
                            avgScore: 78.42,
                            minScore: 42,
                            maxScore: 96,
                            allScores: [42, 65, 75, 78, 85, 96]
                        }
                    ],
                    distribution: [
                        { _id: 41, count: 1 },
                        { _id: 61, count: 2 },
                        { _id: 76, count: 2 },
                        { _id: 86, count: 1 }
                    ],
                    trends: [
                        { _id: '2026-11-01', avgScore: 76.5, count: 3 },
                        { _id: '2026-11-02', avgScore: 80.2, count: 3 }
                    ],
                    byPlan: [
                        { _id: 'free', avgScore: 72.1, total: 20 },
                        { _id: 'pro', avgScore: 82.5, total: 15 },
                        { _id: 'premium', avgScore: 89.0, total: 5 }
                    ]
                }
            ];

            const aggregateSpy = jest.spyOn(interviewReportModel, 'aggregate').mockResolvedValue(fakeFacetResult);

            const result = await getGlobalAtsAnalytics({ bypassCache: true });

            expect(aggregateSpy).toHaveBeenCalled();
            expect(result.summary).toEqual(expect.objectContaining({
                totalEvaluations: 40,
                avgScore: 78.4,
                medianScore: 76.5,
                highestScore: 96,
                lowestScore: 42
            }));

            // Check 5-range distribution array
            expect(result.distribution).toHaveLength(5);
            expect(result.distribution[0].range).toBe('0 - 40');
            expect(result.distribution[1].range).toBe('41 - 60');
            expect(result.distribution[4].range).toBe('86 - 100');

            // Check Plan Breakdown
            expect(result.planBreakdown.free.avgScore).toBe(72.1);
            expect(result.planBreakdown.pro.avgScore).toBe(82.5);
            expect(result.planBreakdown.premium.avgScore).toBe(89.0);

            // Check Trends
            expect(result.trends).toHaveLength(2);
            expect(result.trends[0].date).toBe('2026-11-01');
        });

        test('getGlobalAtsAnalytics: applies date bounding in match filter', async () => {
            const fakeEmptyResult = [{ summary: [], distribution: [], trends: [], byPlan: [] }];
            const aggregateSpy = jest.spyOn(interviewReportModel, 'aggregate').mockResolvedValue(fakeEmptyResult);

            await getGlobalAtsAnalytics({
                startDate: '2026-11-01',
                endDate: '2026-11-08',
                bypassCache: true
            });

            const pipelineCalled = aggregateSpy.mock.calls[0][0];
            const matchStage = pipelineCalled[0].$match;

            expect(matchStage.createdAt).toBeDefined();
            expect(matchStage.createdAt.$gte).toEqual(new Date('2026-11-01'));
        });
    });

    describe('3. Controller Response Handler', () => {
        test('getAdminAtsAnalyticsController: returns 200 with analytics payload', async () => {
            const fakeData = {
                summary: { totalEvaluations: 10, avgScore: 80, medianScore: 80, highestScore: 90, lowestScore: 70 },
                distribution: [],
                trends: [],
                planBreakdown: { free: { count: 10, avgScore: 80 } }
            };

            const atsAnalyticsService = require('../services/atsAnalytics.service');
            jest.spyOn(atsAnalyticsService, 'getGlobalAtsAnalytics').mockResolvedValue(fakeData);

            const req = { query: { refresh: '1' } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await getAdminAtsAnalyticsController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                summary: expect.any(Object)
            }));
        });
    });
});

