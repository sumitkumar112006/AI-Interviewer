/**
 * couponAndDiscount.test.js — Coupon & Discount Engine Test Suite
 *
 * Tests:
 * 1. Pure paymentLogic discount calculation (percentage, fixed, caps, min order, date ranges).
 * 2. Coupon validation during checkout (ineligible plans, expired, limits, per-user limits).
 * 3. Atomic redemption and race condition prevention.
 * 4. Integration with order creation (server-side discount calculation, client spoof prevention).
 * 5. Integration with invoice generation (coupon code & discount reflected in final invoice).
 * 6. Admin Coupon CRUD controllers and status toggling.
 */

'use strict';

jest.mock('../jobs/aiQueue', () => ({
    aiQueue: {
        getJob: jest.fn().mockResolvedValue(null),
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
        getWorkers: jest.fn().mockResolvedValue([])
    },
    enqueueAiJob: jest.fn().mockResolvedValue({ id: 'bull-job-test' })
}));

const mongoose = require('mongoose');
const { calculateCouponDiscount } = require('../services/paymentLogic');
const Coupon = require('../models/coupon.model');
const CouponRedemption = require('../models/couponRedemption.model');
const couponService = require('../services/coupon.service');
const orderService = require('../services/order.service');
const invoiceService = require('../services/invoice.service');
const PaymentOrder = require('../models/paymentOrder.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');
const userModel = require('../models/user.model');
const { Invoice } = require('../models/invoice.model');
const auditLogService = require('../services/auditLog.service');
const systemEventModel = require('../models/systemEvent.model');
const {
    listCouponsController,
    createCouponController,
    updateCouponController,
    toggleCouponStatusController
} = require('../controller/coupon.controller');

describe('Coupon and Discount Engine Test Suite', () => {
    let mockAuditSpy;
    let mockSystemEventSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue(true);
        mockSystemEventSpy = jest.spyOn(systemEventModel, 'recordOperationalEvent').mockResolvedValue(true);
    });

    afterEach(() => {
        mockAuditSpy.mockRestore();
        mockSystemEventSpy.mockRestore();
    });

    describe('1. Pure Coupon Calculation Logic (paymentLogic.js)', () => {
        it('calculates standard percentage discount correctly', () => {
            const coupon = {
                isActive: true,
                discountType: 'PERCENTAGE',
                discountValue: 20 // 20%
            };
            const result = calculateCouponDiscount(coupon, 19900, 'pro'); // ₹199.00
            expect(result.discountAmount).toBe(3980); // ₹39.80
            expect(result.finalAmount).toBe(15920); // ₹159.20
            expect(result.originalAmount).toBe(19900);
        });

        it('respects max discount cap on percentage coupons', () => {
            const coupon = {
                isActive: true,
                discountType: 'PERCENTAGE',
                discountValue: 50, // 50%
                maxDiscountAmount: 5000 // Max cap ₹50.00 (5000 paise)
            };
            // On a ₹349.00 order, 50% would be ₹174.50, but capped at ₹50.00
            const result = calculateCouponDiscount(coupon, 34900, 'premium');
            expect(result.discountAmount).toBe(5000);
            expect(result.finalAmount).toBe(29900);
        });

        it('calculates fixed discount correctly', () => {
            const coupon = {
                isActive: true,
                discountType: 'FIXED',
                discountValue: 10000 // Flat ₹100.00 off
            };
            const result = calculateCouponDiscount(coupon, 34900, 'premium');
            expect(result.discountAmount).toBe(10000);
            expect(result.finalAmount).toBe(24900);
        });

        it('enforces gateway minimum payable amount of 100 paise (₹1.00)', () => {
            const coupon = {
                isActive: true,
                discountType: 'FIXED',
                discountValue: 20000 // Flat ₹200.00 off on ₹199.00
            };
            const result = calculateCouponDiscount(coupon, 19900, 'pro');
            expect(result.finalAmount).toBe(100); // 100 paise minimum
            expect(result.discountAmount).toBe(19800);
        });

        it('rejects inactive coupon', () => {
            expect(() => {
                calculateCouponDiscount({ isActive: false }, 19900, 'pro');
            }).toThrow('COUPON_INACTIVE');
        });

        it('rejects expired coupon', () => {
            expect(() => {
                calculateCouponDiscount({
                    isActive: true,
                    expirationDate: new Date(Date.now() - 3600000)
                }, 19900, 'pro');
            }).toThrow('COUPON_EXPIRED');
        });

        it('rejects coupon not yet started', () => {
            expect(() => {
                calculateCouponDiscount({
                    isActive: true,
                    startDate: new Date(Date.now() + 3600000)
                }, 19900, 'pro');
            }).toThrow('COUPON_NOT_STARTED');
        });

        it('rejects when order amount is below minOrderValue', () => {
            expect(() => {
                calculateCouponDiscount({
                    isActive: true,
                    minOrderValue: 25000 // Min ₹250.00
                }, 19900, 'pro');
            }).toThrow('MIN_ORDER_VALUE_NOT_MET');
        });

        it('rejects when plan is not in eligiblePlans', () => {
            expect(() => {
                calculateCouponDiscount({
                    isActive: true,
                    eligiblePlans: ['premium']
                }, 19900, 'pro');
            }).toThrow('COUPON_INELIGIBLE_FOR_PLAN');
        });

        it('rejects when total usage limit is exhausted', () => {
            expect(() => {
                calculateCouponDiscount({
                    isActive: true,
                    usageLimit: 10,
                    usedCount: 10
                }, 19900, 'pro');
            }).toThrow('COUPON_USAGE_LIMIT_EXCEEDED');
        });
    });

    describe('2. Coupon Service Management (Admin & Checkout)', () => {
        it('creates a new coupon with normalized code and records audit trail', async () => {
            const mockSavedCoupon = {
                _id: 'coupon-1',
                code: 'SUMMER25',
                discountType: 'PERCENTAGE',
                discountValue: 25,
                isActive: true,
                toObject: () => ({ code: 'SUMMER25', discountValue: 25 })
            };

            jest.spyOn(Coupon, 'findOne').mockResolvedValueOnce(null);
            jest.spyOn(Coupon.prototype, 'save').mockResolvedValueOnce(mockSavedCoupon);

            const coupon = await couponService.createCoupon({
                code: 'summer25',
                discountType: 'PERCENTAGE',
                discountValue: 25,
                eligiblePlans: ['pro', 'premium']
            }, { actorUsername: 'admin1', actorRole: 'billing_admin' });

            expect(Coupon.prototype.save).toHaveBeenCalled();
            expect(mockAuditSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'COUPON_CREATED',
                targetIdentifier: 'SUMMER25'
            }));
            expect(mockSystemEventSpy).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'COUPON_CREATED'
            }));
        });

        it('rejects duplicate coupon code creation', async () => {
            jest.spyOn(Coupon, 'findOne').mockResolvedValueOnce({ code: 'DUPLICATE' });

            await expect(couponService.createCoupon({
                code: 'DUPLICATE',
                discountType: 'PERCENTAGE',
                discountValue: 10
            })).rejects.toEqual(expect.objectContaining({
                status: 400,
                message: expect.stringMatching(/already exists/i)
            }));
        });

        it('validates a coupon for checkout and returns formatted savings', async () => {
            const mockCoupon = {
                _id: new mongoose.Types.ObjectId(),
                code: 'FLAT50',
                discountType: 'FIXED',
                discountValue: 5000, // ₹50.00
                minOrderValue: 10000,
                startDate: new Date(Date.now() - 10000),
                expirationDate: new Date(Date.now() + 100000),
                usageLimit: 100,
                usedCount: 12,
                perUserLimit: 2,
                eligiblePlans: ['pro', 'premium'],
                isActive: true
            };

            jest.spyOn(Coupon, 'findOne').mockResolvedValueOnce(mockCoupon);
            jest.spyOn(CouponRedemption, 'countDocuments').mockResolvedValueOnce(1); // Used 1 time, limit is 2

            const validation = await couponService.validateCouponForCheckout({
                code: 'FLAT50',
                userId: 'user-1',
                planKey: 'pro',
                orderAmount: 19900
            });

            expect(validation.valid).toBe(true);
            expect(validation.discountAmount).toBe(5000);
            expect(validation.finalAmount).toBe(14900);
            expect(validation.savingsFormatted).toBe('₹50.00');
        });

        it('rejects checkout validation when per-user limit is reached', async () => {
            const mockCoupon = {
                _id: new mongoose.Types.ObjectId(),
                code: 'ONCEONLY',
                discountType: 'PERCENTAGE',
                discountValue: 10,
                startDate: new Date(Date.now() - 1000),
                perUserLimit: 1,
                eligiblePlans: ['pro'],
                isActive: true
            };

            jest.spyOn(Coupon, 'findOne').mockResolvedValueOnce(mockCoupon);
            jest.spyOn(CouponRedemption, 'countDocuments').mockResolvedValueOnce(1); // Already used 1x

            await expect(couponService.validateCouponForCheckout({
                code: 'ONCEONLY',
                userId: 'user-1',
                planKey: 'pro',
                orderAmount: 19900
            })).rejects.toEqual(expect.objectContaining({
                status: 400,
                message: expect.stringMatching(/maximum allowed number of times/i)
            }));
        });

        it('atomically increments usedCount and creates CouponRedemption in applyCouponToOrder', async () => {
            const mockCoupon = {
                _id: new mongoose.Types.ObjectId(),
                code: 'SAVE10',
                discountType: 'PERCENTAGE',
                discountValue: 10,
                startDate: new Date(Date.now() - 1000),
                eligiblePlans: ['pro'],
                isActive: true,
                usageLimit: 50,
                usedCount: 5
            };

            jest.spyOn(Coupon, 'findOne').mockResolvedValueOnce(mockCoupon);
            jest.spyOn(Coupon, 'findById').mockResolvedValueOnce(mockCoupon);
            jest.spyOn(CouponRedemption, 'countDocuments').mockResolvedValueOnce(0);
            jest.spyOn(Coupon, 'findOneAndUpdate').mockResolvedValueOnce({
                ...mockCoupon,
                usedCount: 6
            });
            jest.spyOn(CouponRedemption.prototype, 'save').mockResolvedValueOnce(true);

            const mockOrder = {
                _id: new mongoose.Types.ObjectId(),
                planKey: 'pro',
                amount: 19900
            };

            const updatedOrder = await couponService.applyCouponToOrder({
                order: mockOrder,
                couponCode: 'SAVE10',
                userId: 'user-123'
            });

            expect(Coupon.findOneAndUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ _id: mockCoupon._id, isActive: true }),
                expect.objectContaining({ $inc: { usedCount: 1 } }),
                expect.anything()
            );
            expect(updatedOrder.couponCode).toBe('SAVE10');
            expect(updatedOrder.discountAmount).toBe(1990);
            expect(updatedOrder.amount).toBe(17910);
        });

        it('releases coupon reservation if order fails gateway initialization', async () => {
            const mockRedemption = {
                _id: 'red-1',
                couponId: 'cpn-1',
                status: 'PENDING',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(CouponRedemption, 'findOne').mockResolvedValueOnce(mockRedemption);
            const couponUpdateSpy = jest.spyOn(Coupon, 'updateOne').mockResolvedValueOnce({ modifiedCount: 1 });

            await couponService.releaseCouponOnFailure({ orderId: 'order-fail-1' });

            expect(mockRedemption.status).toBe('FAILED');
            expect(mockRedemption.save).toHaveBeenCalled();
            expect(couponUpdateSpy).toHaveBeenCalledWith(
                expect.objectContaining({ _id: 'cpn-1' }),
                expect.objectContaining({ $inc: { usedCount: -1 } })
            );
        });
    });

    describe('3. Integration: Order Creation & Server-Side Security', () => {
        it('calculates order discount server-side and stores coupon fields in PaymentOrder', async () => {
            const mockCoupon = {
                _id: new mongoose.Types.ObjectId(),
                code: 'WELCOME20',
                discountType: 'PERCENTAGE',
                discountValue: 20,
                startDate: new Date(Date.now() - 1000),
                eligiblePlans: ['pro'],
                isActive: true
            };

            jest.spyOn(Coupon, 'findOne').mockResolvedValue(mockCoupon);
            jest.spyOn(Coupon, 'findById').mockResolvedValue(mockCoupon);
            jest.spyOn(CouponRedemption, 'countDocuments').mockResolvedValue(0);
            jest.spyOn(Coupon, 'findOneAndUpdate').mockResolvedValue(mockCoupon);
            jest.spyOn(CouponRedemption.prototype, 'save').mockResolvedValue(true);

            jest.spyOn(SubscriptionPlan, 'findOneAndUpdate').mockResolvedValue({
                _id: 'plan-pro-id',
                name: 'Pro Plan',
                planKey: 'pro',
                price: 19900,
                priceMonthly: 19900,
                currency: 'INR'
            });

            let createdOrderDoc;
            jest.spyOn(PaymentOrder, 'findOne').mockResolvedValue(null);
            jest.spyOn(PaymentOrder, 'findOneAndUpdate').mockImplementation((query, update) => {
                createdOrderDoc = {
                    _id: new mongoose.Types.ObjectId(),
                    ...update.$setOnInsert,
                    save: jest.fn().mockResolvedValue(true)
                };
                return Promise.resolve(createdOrderDoc);
            });

            const razorpayService = require('../services/razorpay.service');
            jest.spyOn(razorpayService, 'createRazorpayOrder').mockResolvedValue({ id: 'rzp_order_test_123' });

            const result = await orderService.createOrder({
                userId: new mongoose.Types.ObjectId(),
                planKey: 'pro',
                billingCycle: 'MONTHLY',
                couponCode: 'WELCOME20'
            });

            expect(result.order.couponCode).toBe('WELCOME20');
            expect(result.order.discountAmount).toBe(3980); // 20% of 19900
            expect(result.order.amount).toBe(15920); // Verified final payable amount
            expect(razorpayService.createRazorpayOrder).toHaveBeenCalledWith(expect.objectContaining({
                amount: 15920 // Gateway order generated with verified server-side amount
            }));
        });
    });

    describe('4. Integration: Invoice Generation Reflecting Verified Coupon & Payment', () => {
        it('generates an immutable invoice reflecting original price, coupon discount, and verified payment total', async () => {
            const mockOrder = {
                _id: new mongoose.Types.ObjectId(),
                userId: new mongoose.Types.ObjectId(),
                planKey: 'pro',
                billingCycle: 'MONTHLY',
                originalAmount: 19900,
                discountAmount: 3980,
                amount: 15920,
                couponCode: 'SAVE20',
                currency: 'INR'
            };

            const mockPayment = {
                _id: new mongoose.Types.ObjectId()
            };

            jest.spyOn(Invoice, 'findOne').mockResolvedValue(null);
            jest.spyOn(userModel, 'findById').mockResolvedValue({
                _id: 'user-id',
                username: 'johndoe',
                email: 'johndoe@example.com'
            });
            jest.spyOn(invoiceService, 'getNextInvoiceNumber').mockResolvedValue('INV-202611-000001');

            let savedInvoiceDoc;
            jest.spyOn(Invoice.prototype, 'save').mockImplementation(function () {
                savedInvoiceDoc = this;
                return Promise.resolve(savedInvoiceDoc);
            });

            const invoice = await invoiceService.generateInvoice({
                order: mockOrder,
                payment: mockPayment,
                subscription: { _id: 'sub-1' }
            });

            expect(invoice.invoiceNumber).toBe('INV-202611-000001');
            expect(invoice.discountAmount).toBe(3980);
            expect(invoice.couponCode).toBe('SAVE20');
            expect(invoice.totalAmount).toBe(15920); // Exactly matches verified payment
            expect(invoice.items[0].unitAmount).toBe(19900); // Original plan price
        });
    });

    describe('5. Admin Coupon Controllers', () => {
        it('listCouponsController returns paginated coupons and stats', async () => {
            const req = { query: { page: 1, limit: 10 } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            jest.spyOn(couponService, 'listCoupons').mockResolvedValue({
                coupons: [{ code: 'TEST10' }],
                pagination: { total: 1 },
                stats: { totalCoupons: 1, activeCoupons: 1 }
            });

            await listCouponsController(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({ coupons: expect.any(Array) })
            }));
        });

        it('createCouponController creates coupon and returns HTTP 201', async () => {
            const req = {
                user: { _id: 'admin-1', username: 'billadmin', role: 'billing_admin' },
                body: { code: 'NEW10', discountType: 'PERCENTAGE', discountValue: 10 }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            jest.spyOn(couponService, 'createCoupon').mockResolvedValue({
                code: 'NEW10',
                discountValue: 10
            });

            await createCouponController(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringMatching(/created successfully/i)
            }));
        });

        it('toggleCouponStatusController updates active status and returns HTTP 200', async () => {
            const req = {
                params: { couponId: 'cpn-123' },
                body: { isActive: false },
                user: { _id: 'admin-1', username: 'billadmin', role: 'billing_admin' }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            jest.spyOn(couponService, 'toggleCouponStatus').mockResolvedValue({
                code: 'TEST',
                isActive: false
            });

            await toggleCouponStatusController(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringMatching(/inactive/i)
            }));
        });
    });
});
