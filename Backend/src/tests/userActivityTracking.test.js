/**
 * userActivityTracking.test.js — Comprehensive Test Suite for User Activity Tracking
 *
 * Tests:
 * 1. Two-tier throttling (in-memory + Redis) under repeated requests.
 * 2. Guaranteed prevention of excessive MongoDB writes.
 * 3. Graceful degradation when Redis is offline.
 * 4. Handling of legacy users with missing activity timestamps.
 * 5. Multi-dimensional activity analytics (DAU, WAU, MAU, Dormant, New, Returning).
 * 6. Admin controller & route endpoints for activity metrics and user filtering.
 */

const mongoose = require('mongoose');
const {
    recordUserActivity,
    touchUserActivity,
    getUserActivityAnalytics,
    getUserActivitySummary,
    _clearActivityCacheForTesting,
    ACTIVITY_METRIC_DEFINITIONS
} = require('../services/userActivity.service');
const userModel = require('../models/user.model');
const interviewReportModel = require('../models/interviewReport.model');
const coverLetterModel = require('../models/coverLetter.model');
const redisConfig = require('../config/redis');
const adminController = require('../controller/admin.controller');

describe('User Activity Tracking & Telemetry Test Suite', () => {
    const mockUserId = new mongoose.Types.ObjectId();
    const mockUserIdStr = mockUserId.toString();

    beforeEach(() => {
        _clearActivityCacheForTesting();
        jest.clearAllMocks();
    });

    describe('1. Two-Tier Throttling & MongoDB Write Prevention', () => {
        test('executes MongoDB update on first activity record', async () => {
            const updateOneSpy = jest.spyOn(userModel, 'updateOne').mockReturnValue({
                exec: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
            });

            const result = await recordUserActivity(mockUserId);
            expect(result).toBe(true);
            expect(updateOneSpy).toHaveBeenCalledTimes(1);
            expect(updateOneSpy).toHaveBeenCalledWith(
                { _id: mockUserId },
                expect.objectContaining({
                    $set: expect.objectContaining({
                        lastActiveAt: expect.any(Date)
                    })
                })
            );

            updateOneSpy.mockRestore();
        });

        test('throttles repeated requests within 5-minute window and prevents duplicate MongoDB writes', async () => {
            const updateOneSpy = jest.spyOn(userModel, 'updateOne').mockReturnValue({
                exec: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
            });

            // 1st request — should write to MongoDB
            const firstCall = await recordUserActivity(mockUserId);
            expect(firstCall).toBe(true);
            expect(updateOneSpy).toHaveBeenCalledTimes(1);

            // 20 subsequent rapid calls in the same session — all should be throttled in-memory
            for (let i = 0; i < 20; i++) {
                const throttledCall = await recordUserActivity(mockUserId);
                expect(throttledCall).toBe(false);
            }

            // Verify MongoDB was NEVER called more than once
            expect(updateOneSpy).toHaveBeenCalledTimes(1);

            updateOneSpy.mockRestore();
        });

        test('bypasses throttling when force=true is passed (e.g., explicit login)', async () => {
            const updateOneSpy = jest.spyOn(userModel, 'updateOne').mockReturnValue({
                exec: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
            });

            await recordUserActivity(mockUserId);
            expect(updateOneSpy).toHaveBeenCalledTimes(1);

            // Normal call is throttled
            const throttled = await recordUserActivity(mockUserId);
            expect(throttled).toBe(false);
            expect(updateOneSpy).toHaveBeenCalledTimes(1);

            // Forced call (login event) triggers update
            const forced = await recordUserActivity(mockUserId, { force: true });
            expect(forced).toBe(true);
            expect(updateOneSpy).toHaveBeenCalledTimes(2);

            updateOneSpy.mockRestore();
        });

        test('handles null or undefined userId safely without errors', async () => {
            const updateOneSpy = jest.spyOn(userModel, 'updateOne');
            const resultNull = await recordUserActivity(null);
            const resultUndefined = await recordUserActivity(undefined);

            expect(resultNull).toBe(false);
            expect(resultUndefined).toBe(false);
            expect(updateOneSpy).not.toHaveBeenCalled();
            updateOneSpy.mockRestore();
        });
    });

    describe('2. Redis Coordination and Resilient Offline Fallback', () => {
        test('sets Redis key with 300s TTL when Redis is ready', async () => {
            const mockRedisSet = jest.fn().mockResolvedValue('OK');
            const mockRedisGet = jest.fn().mockResolvedValue(null);
            jest.spyOn(redisConfig, 'getRedisClient').mockReturnValue({
                status: 'ready',
                set: mockRedisSet,
                get: mockRedisGet
            });

            const updateOneSpy = jest.spyOn(userModel, 'updateOne').mockReturnValue({
                exec: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
            });

            await recordUserActivity(mockUserId);

            expect(mockRedisSet).toHaveBeenCalledWith(
                `activity:user:${mockUserIdStr}`,
                expect.any(String),
                'EX',
                300
            );

            updateOneSpy.mockRestore();
            redisConfig.getRedisClient.mockRestore();
        });

        test('syncs from Redis when updated by another worker node', async () => {
            const mockRedisGet = jest.fn().mockResolvedValue('1700000000000');
            jest.spyOn(redisConfig, 'getRedisClient').mockReturnValue({
                status: 'ready',
                get: mockRedisGet
            });

            const updateOneSpy = jest.spyOn(userModel, 'updateOne');

            // Cache was cleared, but Redis has active key from another server
            const result = await recordUserActivity(mockUserId);

            expect(result).toBe(false);
            expect(mockRedisGet).toHaveBeenCalledWith(`activity:user:${mockUserIdStr}`);
            expect(updateOneSpy).not.toHaveBeenCalled();

            updateOneSpy.mockRestore();
            redisConfig.getRedisClient.mockRestore();
        });

        test('gracefully continues via local fallback when Redis throws an error', async () => {
            jest.spyOn(redisConfig, 'getRedisClient').mockReturnValue({
                status: 'ready',
                get: jest.fn().mockRejectedValue(new Error('Redis connection lost')),
                set: jest.fn().mockRejectedValue(new Error('Redis connection lost'))
            });

            const updateOneSpy = jest.spyOn(userModel, 'updateOne').mockReturnValue({
                exec: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
            });

            // Should not throw; falls back to MongoDB write and local memory cache
            const result = await recordUserActivity(mockUserId);
            expect(result).toBe(true);
            expect(updateOneSpy).toHaveBeenCalledTimes(1);

            updateOneSpy.mockRestore();
            redisConfig.getRedisClient.mockRestore();
        });
    });

    describe('3. Asynchronous touchUserActivity Helper', () => {
        test('touchUserActivity fires asynchronously and safely handles errors', (done) => {
            const updateOneSpy = jest.spyOn(userModel, 'updateOne').mockReturnValue({
                exec: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
            });

            touchUserActivity(mockUserId);

            // Wait for next tick / setImmediate
            setImmediate(() => {
                expect(updateOneSpy).toHaveBeenCalledTimes(1);
                updateOneSpy.mockRestore();
                done();
            });
        });
    });

    describe('4. User Activity Analytics Aggregation & Definitions', () => {
        test('getUserActivityAnalytics returns structured metrics and documented definitions', async () => {
            const mockFacetOutput = [{
                totalUsers: [{ count: 75 }],
                dau: [{ count: 12 }],
                wau: [{ count: 28 }],
                mau: [{ count: 45 }],
                dormant: [{ count: 22 }],
                newRegistrations: [{ count: 15 }],
                returningUsers: [{ count: 30 }],
                neverActive: [{ count: 8 }],
                planBreakdown: [
                    { _id: 'free', total: 67, activeMau: 38, activeDau: 10 },
                    { _id: 'pro', total: 4, activeMau: 4, activeDau: 1 },
                    { _id: 'premium', total: 4, activeMau: 3, activeDau: 1 }
                ]
            }];

            const aggregateSpy = jest.spyOn(userModel, 'aggregate')
                .mockResolvedValueOnce(mockFacetOutput) // Facet query
                .mockResolvedValueOnce([ // Daily trend query
                    { _id: '2026-11-08', count: 12 },
                    { _id: '2026-11-07', count: 9 }
                ]);

            const analytics = await getUserActivityAnalytics({ timeframe: '30d' });

            expect(analytics).toHaveProperty('metrics');
            expect(analytics.metrics.totalUsers).toBe(75);
            expect(analytics.metrics.dau).toBe(12);
            expect(analytics.metrics.wau).toBe(28);
            expect(analytics.metrics.mau).toBe(45);
            expect(analytics.metrics.dormant).toBe(22);
            expect(analytics.metrics.newRegistrations).toBe(15);
            expect(analytics.metrics.returningUsers).toBe(30);
            expect(analytics.metrics.neverActive).toBe(8);
            expect(analytics.metrics.dauToMauRatio).toBe(26.7); // (12/45)*100

            // Verify definitions
            expect(analytics.definitions).toHaveProperty('DAU');
            expect(analytics.definitions).toHaveProperty('WAU');
            expect(analytics.definitions).toHaveProperty('MAU');
            expect(analytics.definitions).toHaveProperty('DORMANT');
            expect(analytics.definitions).toHaveProperty('RETURNING_USERS');

            // Verify daily trend is formatted with zero-fill continuous dates
            expect(analytics.dailyActiveTrend.length).toBe(30);

            aggregateSpy.mockRestore();
        });

        test('getUserActivitySummary returns fast lightweight overview stats', async () => {
            const mockSummaryOutput = [{
                dau: [{ count: 14 }],
                wau: [{ count: 32 }],
                mau: [{ count: 50 }],
                dormant: [{ count: 20 }],
                newLast7Days: [{ count: 7 }],
                returningLast7Days: [{ count: 25 }]
            }];

            const aggregateSpy = jest.spyOn(userModel, 'aggregate').mockResolvedValueOnce(mockSummaryOutput);

            const summary = await getUserActivitySummary();
            expect(summary).toEqual({
                dau: 14,
                wau: 32,
                mau: 50,
                dormant: 20,
                newLast7Days: 7,
                returningLast7Days: 25
            });

            // Verify the facet pipeline uses distinct 7-day vs 30-day boundary ObjectIds
            const facetCall = aggregateSpy.mock.calls[0][0][1].$facet;
            const new7dMatch = facetCall.newLast7Days[0].$match;
            const dormantMatch = facetCall.dormant[0].$match;

            // Extract the fallback ObjectIds
            const new7dFallbackId = new7dMatch.$or[1]._id.$gte;
            const dormantFallbackId = dormantMatch.$or[1].$or[1]._id.$lt;

            // 7-day fallback ID must be strictly greater than 30-day fallback ID (more recent timestamp)
            expect(new7dFallbackId.getTimestamp().getTime()).toBeGreaterThan(dormantFallbackId.getTimestamp().getTime());

            aggregateSpy.mockRestore();
        });
    });

    describe('5. Admin Controller Endpoints & Activity Filtering', () => {
        test('getUserActivityAnalyticsController returns 200 with complete telemetry', async () => {
            const req = { query: { timeframe: '30d' } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const mockFacetOutput = [{
                totalUsers: [{ count: 75 }],
                dau: [{ count: 10 }],
                wau: [{ count: 25 }],
                mau: [{ count: 40 }],
                dormant: [{ count: 25 }],
                newRegistrations: [{ count: 5 }],
                returningUsers: [{ count: 35 }],
                neverActive: [{ count: 10 }],
                planBreakdown: []
            }];

            const aggregateSpy = jest.spyOn(userModel, 'aggregate')
                .mockResolvedValueOnce(mockFacetOutput)
                .mockResolvedValueOnce([]);

            await adminController.getUserActivityAnalyticsController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    metrics: expect.objectContaining({
                        dau: 10,
                        mau: 40,
                        dormant: 25
                    })
                })
            }));

            aggregateSpy.mockRestore();
        });

        test('getAdminUsersController handles activity=dormant filter query correctly', async () => {
            const req = {
                query: { activity: 'dormant', page: 1, limit: 20 }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const findSpy = jest.spyOn(userModel, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            });
            const countSpy = jest.spyOn(userModel, 'countDocuments').mockResolvedValue(0);
            const reportAggSpy = jest.spyOn(interviewReportModel, 'aggregate').mockResolvedValue([]);
            const clAggSpy = jest.spyOn(coverLetterModel, 'aggregate').mockResolvedValue([]);

            await adminController.getAdminUsersController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            // Verify query constructed with $or containing lastActiveAt < 30 days
            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                $and: expect.arrayContaining([
                    expect.objectContaining({
                        $or: expect.any(Array)
                    })
                ])
            }));

            findSpy.mockRestore();
            countSpy.mockRestore();
            reportAggSpy.mockRestore();
            clAggSpy.mockRestore();
        });

        test('getAdminStatsController includes activity metrics in response', async () => {
            const req = {};
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const countUsersSpy = jest.spyOn(userModel, 'countDocuments').mockResolvedValue(75);
            const countReportsSpy = jest.spyOn(interviewReportModel, 'countDocuments').mockResolvedValue(10);
            const countClSpy = jest.spyOn(coverLetterModel, 'countDocuments').mockResolvedValue(5);
            const userAggSpy = jest.spyOn(userModel, 'aggregate').mockImplementation((pipeline) => {
                // If facet query (activity summary)
                if (pipeline?.[1]?.$facet) {
                    return Promise.resolve([{
                        dau: [{ count: 15 }],
                        wau: [{ count: 35 }],
                        mau: [{ count: 55 }],
                        dormant: [{ count: 18 }],
                        newLast7Days: [{ count: 6 }],
                        returningLast7Days: [{ count: 29 }]
                    }]);
                }
                return Promise.resolve([]);
            });

            await adminController.getAdminStatsController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                stats: expect.objectContaining({
                    totalUsers: 75,
                    activity: expect.objectContaining({
                        dau: 15,
                        wau: 35,
                        mau: 55,
                        dormant: 18
                    })
                })
            }));

            countUsersSpy.mockRestore();
            countReportsSpy.mockRestore();
            countClSpy.mockRestore();
            userAggSpy.mockRestore();
        });
    });
});
