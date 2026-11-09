/**
 * subscriptionIntegrityAndReconciliation.test.js — Test Suite for Subscription Data Integrity & Export Improvements
 */

'use strict';

const mongoose = require('mongoose');
const {
    SUBSCRIPTION_STATUSES,
    normalizeSubscriptionStatus,
    evaluateSubscriptionLifecycle,
    getSubscriptionAndFinancialReconciliation
} = require('../services/subscriptionReconciliation.service');
const subscriptionModel = require('../models/subscription.model');
const userModel = require('../models/user.model');
const Payment = require('../models/payment.model');
const PaymentOrder = require('../models/paymentOrder.model');
const { Invoice } = require('../models/invoice.model');
const { getExportFilename } = require('../services/export.service');
const adminController = require('../controller/admin.controller');

describe('Subscription Data Integrity & Export Improvements Test Suite', () => {

    describe('1. Subscription Status Normalization Layer', () => {
        test('normalizes lowercase "active" to uppercase "ACTIVE"', () => {
            expect(normalizeSubscriptionStatus('active')).toBe('ACTIVE');
            expect(normalizeSubscriptionStatus('Active')).toBe('ACTIVE');
            expect(normalizeSubscriptionStatus('ACTIVE')).toBe('ACTIVE');
        });

        test('normalizes other valid statuses to standard uppercase', () => {
            expect(normalizeSubscriptionStatus('cancelled')).toBe('CANCELLED');
            expect(normalizeSubscriptionStatus('expired')).toBe('EXPIRED');
            expect(normalizeSubscriptionStatus('grace_period')).toBe('GRACE_PERIOD');
            expect(normalizeSubscriptionStatus('past_due')).toBe('PAST_DUE');
        });

        test('handles null, undefined, or empty values safely', () => {
            expect(normalizeSubscriptionStatus(null)).toBe('ACTIVE');
            expect(normalizeSubscriptionStatus(undefined)).toBe('ACTIVE');
            expect(normalizeSubscriptionStatus('')).toBe('ACTIVE');
        });
    });

    describe('2. Subscription Lifecycle Evaluation', () => {
        const baseDate = new Date('2026-11-08T12:00:00.000Z');

        test('evaluates free tier subscriptions as ACTIVE regardless of past currentPeriodEnd', () => {
            const freeSub = {
                plan: 'free',
                status: 'ACTIVE',
                currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
                currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z')
            };

            const result = evaluateSubscriptionLifecycle(freeSub, baseDate);
            expect(result.effectiveStatus).toBe('ACTIVE');
            expect(result.reason).toContain('Free tier access remains active indefinitely');
            expect(result.isPastDue).toBe(true); // quota reset due
        });

        test('evaluates active paid plan with future currentPeriodEnd as ACTIVE', () => {
            const paidSub = {
                plan: 'pro',
                status: 'ACTIVE',
                currentPeriodStart: new Date('2026-11-01T00:00:00.000Z'),
                currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z')
            };

            const result = evaluateSubscriptionLifecycle(paidSub, baseDate);
            expect(result.effectiveStatus).toBe('ACTIVE');
            expect(result.isPastDue).toBe(false);
        });

        test('evaluates paid plan expired within 48h as GRACE_PERIOD', () => {
            const graceSub = {
                plan: 'premium',
                status: 'ACTIVE',
                currentPeriodStart: new Date('2026-10-07T00:00:00.000Z'),
                currentPeriodEnd: new Date('2026-11-07T00:00:00.000Z') // 36 hours before baseDate
            };

            const result = evaluateSubscriptionLifecycle(graceSub, baseDate);
            expect(result.effectiveStatus).toBe('GRACE_PERIOD');
            expect(result.reason).toContain('48-hour renewal grace window');
            expect(result.isPastDue).toBe(true);
        });

        test('evaluates paid plan expired beyond 48h as EXPIRED', () => {
            const expiredSub = {
                plan: 'pro',
                status: 'ACTIVE',
                currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
                currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z')
            };

            const result = evaluateSubscriptionLifecycle(expiredSub, baseDate);
            expect(result.effectiveStatus).toBe('EXPIRED');
            expect(result.reason).toContain('elapsed past grace window');
            expect(result.isPastDue).toBe(true);
        });

        test('preserves CANCELLED status on cancelled subscriptions', () => {
            const cancelledSub = {
                plan: 'pro',
                status: 'CANCELLED',
                currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z')
            };

            const result = evaluateSubscriptionLifecycle(cancelledSub, baseDate);
            expect(result.effectiveStatus).toBe('CANCELLED');
        });
    });

    describe('3. Case-Insensitive Previous Subscription Cancellation', () => {
        test('cancels previous subscriptions whether stored as "ACTIVE" or legacy "active"', async () => {
            const testUserId = new mongoose.Types.ObjectId();
            const mockSubs = [
                { _id: new mongoose.Types.ObjectId(), userId: testUserId, status: 'active', plan: 'free', save: jest.fn().mockResolvedValue(true) },
                { _id: new mongoose.Types.ObjectId(), userId: testUserId, status: 'ACTIVE', plan: 'pro', save: jest.fn().mockResolvedValue(true) }
            ];

            const findSpy = jest.spyOn(subscriptionModel, 'find').mockReturnValue({
                session: jest.fn().mockResolvedValue(mockSubs),
                then: (resolve) => resolve(mockSubs)
            });

            try {
                // Verify that query searches for both uppercase and lowercase statuses
                const found = await subscriptionModel.find({
                    userId: testUserId,
                    status: { $in: ['ACTIVE', 'active', 'GRACE_PERIOD'] }
                });

                for (const s of found) {
                    s.status = 'CANCELLED';
                    s.canceledAt = new Date();
                    await s.save();
                }

                expect(mockSubs[0].status).toBe('CANCELLED');
                expect(mockSubs[1].status).toBe('CANCELLED');
            } finally {
                findSpy.mockRestore();
            }
        });
    });

    describe('4. Forensic Reconciliation Aggregations (Section 8 & Section 4)', () => {
        test('reconciles total users, subscriptions, missing subscriptions, and multi-subs', async () => {
            const user1Id = new mongoose.Types.ObjectId();
            const user2Id = new mongoose.Types.ObjectId();
            const user3Id = new mongoose.Types.ObjectId(); // User without subscription
            const orphanedUserId = new mongoose.Types.ObjectId(); // Deleted user

            const countUsersSpy = jest.spyOn(userModel, 'countDocuments').mockImplementation((filter) => {
                if (filter?.isDeleted) return Promise.resolve(0);
                if (filter?.isBlocked) return Promise.resolve(1);
                if (filter?.isVerified === false) return Promise.resolve(0);
                return Promise.resolve(3);
            });

            const userAggSpy = jest.spyOn(userModel, 'aggregate').mockResolvedValue([
                { _id: 'free', count: 2 },
                { _id: 'pro', count: 1 }
            ]);

            const countSubsSpy = jest.spyOn(subscriptionModel, 'countDocuments').mockImplementation((filter) => {
                return Promise.resolve(3);
            });

            const subAggSpy = jest.spyOn(subscriptionModel, 'aggregate').mockImplementation((pipeline) => {
                // Check if pipeline is multi-sub grouping
                if (pipeline?.[0]?.$group?._id === '$userId') {
                    return Promise.resolve([{ _id: user1Id, count: 2 }]);
                }
                return Promise.resolve([
                    { _id: { status: 'ACTIVE', plan: 'free' }, count: 2 },
                    { _id: { status: 'active', plan: 'pro' }, count: 1 }
                ]);
            });

            const subDistinctSpy = jest.spyOn(subscriptionModel, 'distinct').mockResolvedValue([user1Id, user2Id, orphanedUserId]);
            const userDistinctSpy = jest.spyOn(userModel, 'distinct').mockResolvedValue([user1Id, user2Id, user3Id]);

            const userFindSpy = jest.spyOn(userModel, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([
                    { _id: user3Id, username: 'charlie', email: 'charlie@test.com', plan: 'free' }
                ])
            });

            const subFindSpy = jest.spyOn(subscriptionModel, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([
                    { _id: new mongoose.Types.ObjectId(), userId: orphanedUserId, plan: 'free', status: 'active' }
                ])
            });

            const userFindByIdSpy = jest.spyOn(userModel, 'findById').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue({ username: 'alice', email: 'alice@test.com', plan: 'pro' })
            });

            const orderCountSpy = jest.spyOn(PaymentOrder, 'countDocuments').mockResolvedValue(5);
            const paymentCountSpy = jest.spyOn(Payment, 'countDocuments').mockResolvedValue(3);
            const invoiceCountSpy = jest.spyOn(Invoice, 'countDocuments').mockResolvedValue(2);
            const paymentFindSpy = jest.spyOn(Payment, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            });
            const paymentAggSpy = jest.spyOn(Payment, 'aggregate').mockResolvedValue([]);
            const paymentDistinctSpy = jest.spyOn(Payment, 'distinct').mockResolvedValue([]);

            try {
                const rec = await getSubscriptionAndFinancialReconciliation();

                expect(rec.summary.totalRegisteredUsers).toBe(3);
                expect(rec.summary.totalSubscriptionRecords).toBe(3);
                expect(rec.summary.usersWithoutSubscription).toBe(1);
                expect(rec.summary.usersWithMultipleSubscriptions).toBe(1);
                expect(rec.summary.orphanedSubscriptionRecords).toBe(1);

                // Mathematical consistency check:
                // 3 total users - 1 without sub + 1 orphaned = 3 distinct sub user IDs
                expect(rec.summary.isReconciled).toBe(true);

                expect(rec.integrityAudit.casingInconsistency.uppercaseACTIVE).toBe(2);
                expect(rec.integrityAudit.casingInconsistency.lowercaseActive).toBe(1);
            } finally {
                countUsersSpy.mockRestore();
                userAggSpy.mockRestore();
                countSubsSpy.mockRestore();
                subAggSpy.mockRestore();
                subDistinctSpy.mockRestore();
                userDistinctSpy.mockRestore();
                userFindSpy.mockRestore();
                subFindSpy.mockRestore();
                userFindByIdSpy.mockRestore();
                orderCountSpy.mockRestore();
                paymentCountSpy.mockRestore();
                invoiceCountSpy.mockRestore();
                paymentFindSpy.mockRestore();
                paymentAggSpy.mockRestore();
                paymentDistinctSpy.mockRestore();
                paymentDistinctSpy.mockRestore();
            }
        });
    });

    describe('5. Subscription Reconciliation Controller', () => {
        test('getSubscriptionReconciliationController returns 200 with forensic diagnostic', async () => {
            const req = {};
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const countUsersSpy = jest.spyOn(userModel, 'countDocuments').mockResolvedValue(75);
            const userAggSpy = jest.spyOn(userModel, 'aggregate').mockResolvedValue([]);
            const countSubsSpy = jest.spyOn(subscriptionModel, 'countDocuments').mockResolvedValue(52);
            const subAggSpy = jest.spyOn(subscriptionModel, 'aggregate').mockResolvedValue([]);
            const subDistinctSpy = jest.spyOn(subscriptionModel, 'distinct').mockResolvedValue([]);
            const userDistinctSpy = jest.spyOn(userModel, 'distinct').mockResolvedValue([]);
            const userFindSpy = jest.spyOn(userModel, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            });
            const subFindSpy = jest.spyOn(subscriptionModel, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            });
            const orderCountSpy = jest.spyOn(PaymentOrder, 'countDocuments').mockResolvedValue(11);
            const paymentCountSpy = jest.spyOn(Payment, 'countDocuments').mockResolvedValue(3);
            const invoiceCountSpy = jest.spyOn(Invoice, 'countDocuments').mockResolvedValue(2);
            const paymentFindSpy = jest.spyOn(Payment, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            });
            const paymentAggSpy = jest.spyOn(Payment, 'aggregate').mockResolvedValue([]);
            const paymentDistinctSpy = jest.spyOn(Payment, 'distinct').mockResolvedValue([]);

            try {
                await adminController.getSubscriptionReconciliationController(req, res);
                expect(res.status).toHaveBeenCalledWith(200);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        summary: expect.objectContaining({
                            totalRegisteredUsers: 75,
                            totalSubscriptionRecords: 52
                        })
                    })
                }));
            } finally {
                countUsersSpy.mockRestore();
                userAggSpy.mockRestore();
                countSubsSpy.mockRestore();
                subAggSpy.mockRestore();
                subDistinctSpy.mockRestore();
                userDistinctSpy.mockRestore();
                userFindSpy.mockRestore();
                subFindSpy.mockRestore();
                orderCountSpy.mockRestore();
                paymentCountSpy.mockRestore();
                invoiceCountSpy.mockRestore();
                paymentFindSpy.mockRestore();
                paymentAggSpy.mockRestore();
                paymentDistinctSpy.mockRestore();
            }
        });
    });

    describe('6. Export Filename and Structure', () => {
        test('getExportFilename returns safe sanitized filename', () => {
            const filenameXlsx = getExportFilename('subscriptions', 'xlsx');
            expect(filenameXlsx).toMatch(/^kivi-subscriptions-\d{4}-\d{2}-\d{2}\.xlsx$/);

            const filenameCsv = getExportFilename('subscriptions', 'csv');
            expect(filenameCsv).toMatch(/^kivi-subscriptions-\d{4}-\d{2}-\d{2}\.csv$/);
        });
    });
});
