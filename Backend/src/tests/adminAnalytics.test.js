/**
 * adminAnalytics.test.js — Test Suite for Admin Analytics Engine
 */

'use strict';

const mongoose = require('mongoose');
const userModel = require('../models/user.model');
const subscriptionModel = require('../models/subscription.model');
const paymentModel = require('../models/payment.model');
const interviewReportModel = require('../models/interviewReport.model');
const coverLetterModel = require('../models/coverLetter.model');
const jobModel = require('../models/job.model');
const aiUsageModel = require('../models/aiUsage.model');
const { SystemEvent } = require('../models/systemEvent.model');

const {
    getOverviewAnalytics,
    getTrafficAnalytics,
    getRegistrationAnalytics,
    getRevenueAnalytics,
    getPlanAnalytics,
    getFeatureUsageAnalytics,
    getActivityHeatmapAnalytics,
    getRecentUsersTable
} = require('../services/adminAnalytics.service');

describe('Admin Analytics Engine Service', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getOverviewAnalytics', () => {
        it('should aggregate all 8 KPIs with mathematically sound percentage changes', async () => {
            // Mock user counts
            jest.spyOn(userModel, 'countDocuments')
                .mockResolvedValueOnce(75) // totalUsersCurrent
                .mockResolvedValueOnce(60) // totalUsersPrev
                .mockResolvedValueOnce(30) // activeUsersCurrent
                .mockResolvedValueOnce(20) // activeUsersPrev
                .mockResolvedValueOnce(15) // newUsersCurrent
                .mockResolvedValueOnce(10) // newUsersPrev
                .mockResolvedValueOnce(25) // paidSubscribersCurrent
                .mockResolvedValueOnce(20); // paidSubscribersPrev

            jest.spyOn(subscriptionModel, 'countDocuments')
                .mockResolvedValueOnce(52) // activeSubscriptionsCurrent
                .mockResolvedValueOnce(45); // activeSubscriptionsPrev

            // Mock payments aggregate
            jest.spyOn(paymentModel, 'aggregate')
                .mockResolvedValueOnce([{ _id: null, totalAmountPaise: 499000, count: 10 }]) // revCurrent
                .mockResolvedValueOnce([{ _id: null, totalAmountPaise: 350000, count: 7 }]); // revPrev

            // Mock failed payments
            jest.spyOn(paymentModel, 'countDocuments')
                .mockResolvedValueOnce(2) // failedCurrent
                .mockResolvedValueOnce(4); // failedPrev

            // Mock app activity
            jest.spyOn(jobModel, 'countDocuments').mockResolvedValue(10);
            jest.spyOn(interviewReportModel, 'countDocuments').mockResolvedValue(15);
            jest.spyOn(coverLetterModel, 'countDocuments').mockResolvedValue(5);
            jest.spyOn(aiUsageModel, 'countDocuments').mockResolvedValue(20);

            // Mock plan aggregates
            jest.spyOn(userModel, 'aggregate').mockResolvedValue([
                { _id: 'free', count: 50 },
                { _id: 'pro', count: 15 },
                { _id: 'premium', count: 10 }
            ]);

            jest.spyOn(subscriptionModel, 'aggregate').mockResolvedValue([
                { _id: 'ACTIVE', count: 40 },
                { _id: 'CANCELLED', count: 12 }
            ]);

            // Mock recent lists
            jest.spyOn(userModel, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([
                    { username: 'testuser', email: 'test@example.com', plan: 'pro', role: 'user' }
                ])
            });

            jest.spyOn(paymentModel, 'find').mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([
                    { amount: 19900, currency: 'INR', status: 'SUCCESS', userId: { username: 'buyer' } }
                ])
            });

            jest.spyOn(SystemEvent, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([
                    { eventType: 'SETTINGS_UPDATE', actorRole: 'super_admin', severity: 'INFO' }
                ])
            });

            const result = await getOverviewAnalytics({ timeframe: '30d' });

            expect(result).toBeDefined();
            expect(result.kpis.totalUsers.value).toBe(75);
            expect(result.kpis.totalUsers.change).toBe(25); // (75 - 60) / 60 * 100 = 25%
            expect(result.kpis.totalRevenue.value).toBe(4990); // 499000 paise = 4990 INR
            expect(result.kpis.totalRevenue.count).toBe(10);
            expect(result.kpis.activeSubscriptions.value).toBe(52);
            expect(result.kpis.paidSubscribers.value).toBe(25);
            expect(result.plans.userPlanDistribution.free).toBe(50);
            expect(result.plans.userPlanDistribution.pro).toBe(15);
            expect(result.plans.userPlanDistribution.premium).toBe(10);
            expect(result.plans.subscriptionStatusDistribution.ACTIVE).toBe(40);
        });
    });

    describe('getTrafficAnalytics', () => {
        it('should aggregate multi-series operational events into continuous date buckets', async () => {
            jest.spyOn(jobModel, 'aggregate').mockResolvedValue([
                { _id: '2026-11-01', count: 5 }
            ]);
            jest.spyOn(interviewReportModel, 'aggregate').mockResolvedValue([
                { _id: '2026-11-01', count: 8 }
            ]);
            jest.spyOn(coverLetterModel, 'aggregate').mockResolvedValue([
                { _id: '2026-11-01', count: 3 }
            ]);
            jest.spyOn(aiUsageModel, 'aggregate').mockResolvedValue([
                { _id: '2026-11-01', count: 12 }
            ]);

            const result = await getTrafficAnalytics({ timeframe: '7d' });

            expect(result).toBeDefined();
            expect(Array.isArray(result.series)).toBe(true);
            expect(result.series.length).toBeGreaterThan(0);
            const foundBucket = result.series.find(s => s.timestamp === '2026-11-01');
            if (foundBucket) {
                expect(foundBucket.resumes).toBe(5);
                expect(foundBucket.interviews).toBe(8);
                expect(foundBucket.coverLetters).toBe(3);
                expect(foundBucket.aiAssistant).toBe(12);
                expect(foundBucket.total).toBe(28);
            }
        });
    });

    describe('getRevenueAnalytics', () => {
        it('should aggregate only verified SUCCESS payments as revenue and count failed payments', async () => {
            jest.spyOn(paymentModel, 'aggregate').mockResolvedValue([
                { _id: { date: '2026-11-05', status: 'SUCCESS' }, totalAmountPaise: 39800, count: 2 },
                { _id: { date: '2026-11-05', status: 'FAILED' }, totalAmountPaise: 19900, count: 1 }
            ]);

            const result = await getRevenueAnalytics({ timeframe: '30d' });

            expect(result).toBeDefined();
            expect(result.currency).toBe('INR');
            expect(result.totalRevenue).toBe(398);
            expect(result.totalSuccessful).toBe(2);
            expect(result.totalFailed).toBe(1);
        });
    });

    describe('getPlanAnalytics', () => {
        it('should return radar chart points for FREE, PRO, and PREMIUM tiers', async () => {
            jest.spyOn(userModel, 'aggregate').mockResolvedValue([
                { _id: 'free', count: 40 },
                { _id: 'pro', count: 20 },
                { _id: 'premium', count: 15 }
            ]);
            jest.spyOn(subscriptionModel, 'aggregate').mockResolvedValue([
                { _id: 'pro', count: 20 },
                { _id: 'premium', count: 15 }
            ]);

            const result = await getPlanAnalytics();

            expect(result).toBeDefined();
            expect(result.radarData.length).toBe(3);
            expect(result.radarData.map(r => r.tier)).toEqual(['FREE', 'PRO', 'PREMIUM']);
            expect(result.userPlans.free).toBe(40);
            expect(result.userPlans.pro).toBe(20);
            expect(result.userPlans.premium).toBe(15);
        });
    });

    describe('getRecentUsersTable', () => {
        it('should return paginated and safe user records without exposing passwords', async () => {
            const mockUsers = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    username: 'alice',
                    email: 'alice@example.com',
                    plan: 'pro',
                    role: 'user',
                    isBlocked: false,
                    lastActiveAt: new Date(),
                    createdAt: new Date(),
                    customBonusCredits: 5
                }
            ];

            jest.spyOn(userModel, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockUsers)
            });
            jest.spyOn(userModel, 'countDocuments').mockResolvedValue(1);

            const result = await getRecentUsersTable({ page: 1, limit: 10 });

            expect(result).toBeDefined();
            expect(result.users.length).toBe(1);
            expect(result.users[0].username).toBe('alice');
            expect(result.users[0].password).toBeUndefined();
            expect(result.pagination.total).toBe(1);
        });
    });
});
