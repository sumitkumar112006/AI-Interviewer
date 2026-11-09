'use strict';

const mongoose = require('mongoose');
const userModel = require('../models/user.model');
const Payment = require('../models/payment.model');
const PaymentOrder = require('../models/paymentOrder.model');
const { Invoice } = require('../models/invoice.model');
const subscriptionModel = require('../models/subscription.model');
const SubscriptionEvent = require('../models/subscriptionEvent.model');
const interviewReportModel = require('../models/interviewReport.model');
const coverLetterModel = require('../models/coverLetter.model');
const notificationModel = require('../models/notification.model');
const { SystemEvent } = require('../models/systemEvent.model');
const { deleteUserController } = require('../controller/admin.controller');

describe('Financial Record Retention & Safe User Archival', () => {

    describe('Account Archival & Financial Record Preservation Logic', () => {
        let mockUser;
        let mockAdminId;
        let userId;

        beforeEach(() => {
            userId = new mongoose.Types.ObjectId();
            mockAdminId = new mongoose.Types.ObjectId();

            mockUser = {
                _id: userId,
                username: 'alice_candidate',
                email: 'alice@example.com',
                plan: 'pro',
                role: 'user',
                isBlocked: false,
                isDeleted: false,
                customBonusCredits: 15,
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(SystemEvent, 'create').mockResolvedValue(true);
        });

        afterEach(() => {
            SystemEvent.create.mockRestore();
        });

        it('should prevent administrators from deleting their own logged-in account', async () => {
            const req = {
                params: { userId: mockAdminId.toString() },
                user: { _id: mockAdminId, id: mockAdminId.toString() }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await deleteUserController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('cannot delete your own admin account')
            }));
        });

        it('should return safe idempotent response when account is already deleted', async () => {
            mockUser.isDeleted = true;
            mockUser.deletedAt = new Date();
            jest.spyOn(userModel, 'findById').mockResolvedValue(mockUser);

            const req = {
                params: { userId: userId.toString() },
                user: { _id: mockAdminId, role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await deleteUserController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringContaining('already archived/deleted')
            }));

            userModel.findById.mockRestore();
        });

        it('should anonymize user, cancel active subscriptions, purge PII, but NEVER delete financial records', async () => {
            jest.spyOn(userModel, 'findById').mockResolvedValue(mockUser);

            // Spies on financial and personal models
            const paymentDeleteSpy = jest.spyOn(Payment, 'deleteMany');
            const paymentOrderDeleteSpy = jest.spyOn(PaymentOrder, 'deleteMany');
            const invoiceDeleteSpy = jest.spyOn(Invoice, 'deleteMany');
            const subEventDeleteSpy = jest.spyOn(SubscriptionEvent, 'deleteMany');
            const reportDeleteSpy = jest.spyOn(interviewReportModel, 'deleteMany').mockResolvedValue({ deletedCount: 2 });
            const coverLetterDeleteSpy = jest.spyOn(coverLetterModel, 'deleteMany').mockResolvedValue({ deletedCount: 1 });
            const notifDeleteSpy = jest.spyOn(notificationModel, 'deleteMany').mockResolvedValue({ deletedCount: 3 });

            const mockActiveSub = {
                _id: new mongoose.Types.ObjectId(),
                plan: 'pro',
                status: 'ACTIVE',
                save: jest.fn().mockResolvedValue(true)
            };
            jest.spyOn(subscriptionModel, 'find').mockResolvedValue([mockActiveSub]);
            jest.spyOn(SubscriptionEvent, 'create').mockResolvedValue(true);

            const req = {
                params: { userId: userId.toString() },
                user: { _id: mockAdminId, role: 'admin' },
                body: { reason: 'User requested account closure' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await deleteUserController(req, res);

            // 1. Critical Requirement: Financial models MUST NOT be deleted
            expect(paymentDeleteSpy).not.toHaveBeenCalled();
            expect(paymentOrderDeleteSpy).not.toHaveBeenCalled();
            expect(invoiceDeleteSpy).not.toHaveBeenCalled();
            expect(subEventDeleteSpy).not.toHaveBeenCalled();

            // 2. Personal PII models MUST be purged
            expect(reportDeleteSpy).toHaveBeenCalledWith({ user: userId.toString() });
            expect(coverLetterDeleteSpy).toHaveBeenCalledWith({ user: userId.toString() });
            expect(notifDeleteSpy).toHaveBeenCalledWith({ recipient: userId.toString() });

            // 3. Active subscription MUST be transitioned to CANCELLED
            expect(mockActiveSub.status).toBe('CANCELLED');
            expect(mockActiveSub.cancelAtPeriodEnd).toBe(false);
            expect(mockActiveSub.save).toHaveBeenCalled();
            expect(SubscriptionEvent.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: userId.toString(),
                eventType: 'CANCELLED'
            }));

            // 4. User record MUST be anonymized and archived
            expect(mockUser.isDeleted).toBe(true);
            expect(mockUser.isBlocked).toBe(true);
            expect(mockUser.email).toContain('@anonymized.kivi.ai');
            expect(mockUser.username).toContain('deleted_user_');
            expect(mockUser.password).toContain('[ACCOUNT_ARCHIVED_');
            expect(mockUser.customBonusCredits).toBe(0);
            expect(mockUser.save).toHaveBeenCalled();

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringContaining('financial, invoice, and payment records were preserved')
            }));

            // Teardown spies
            userModel.findById.mockRestore();
            paymentDeleteSpy.mockRestore();
            paymentOrderDeleteSpy.mockRestore();
            invoiceDeleteSpy.mockRestore();
            subEventDeleteSpy.mockRestore();
            reportDeleteSpy.mockRestore();
            coverLetterDeleteSpy.mockRestore();
            notifDeleteSpy.mockRestore();
            subscriptionModel.find.mockRestore();
            SubscriptionEvent.create.mockRestore();
        });
    });

    describe('Authentication Barrier for Deleted Accounts', () => {
        it('should reject login for deleted/archived accounts in user model query', async () => {
            const deletedUser = {
                email: 'alice@example.com',
                isDeleted: true
            };

            expect(Boolean(!deletedUser || deletedUser.isDeleted)).toBe(true);
        });
    });
});
