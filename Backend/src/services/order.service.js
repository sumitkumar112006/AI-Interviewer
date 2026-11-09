const PaymentOrder = require('../models/paymentOrder.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');
const { PLANS } = require('../constants/plans.constants');
const razorpayService = require('./razorpay.service');
const { buildIdempotencyKey, computeOrderAmount } = require('./paymentLogic');
const couponService = require('./coupon.service');
const { getRedisClient } = require('../config/redis');

class OrderService {
  /**
   * Helper to acquire a short-lived Redis mutex lock against concurrent double-submits
   * @param {string} lockKey 
   * @param {number} ttlSeconds 
   */
  async acquireLock(lockKey, ttlSeconds = 5) {
    try {
      const redis = getRedisClient();
      if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
        const acquired = await redis.set(lockKey, 'locked', 'EX', ttlSeconds, 'NX');
        return acquired === 'OK';
      }
    } catch (e) {
      // Fail-open if Redis is unavailable
    }
    return true;
  }

  /**
   * Release Redis mutex lock
   * @param {string} lockKey 
   */
  async releaseLock(lockKey) {
    try {
      const redis = getRedisClient();
      if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
        await redis.del(lockKey);
      }
    } catch (e) {}
  }

  /**
   * Create an idempotent payment order
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.planKey 'pro' | 'premium'
   * @param {string} params.billingCycle 'MONTHLY' | 'YEARLY'
   * @param {string} [params.userSuppliedIdempotencyKey]
   * @param {string} [params.couponCode]
   * @param {Object} [params.notes]
   */
  async createOrder({ userId, planKey, billingCycle = 'MONTHLY', userSuppliedIdempotencyKey, couponCode, notes = {} }) {
    if (!planKey || typeof planKey !== 'string') {
      throw { status: 400, message: 'Plan key is required (e.g., "pro" or "premium").' };
    }

    const normalizedPlanKey = planKey.trim().toLowerCase();
    const upperPlanKey = normalizedPlanKey.toUpperCase();
    const normalizedCycle = (billingCycle || 'MONTHLY').toUpperCase();

    if (!['MONTHLY', 'YEARLY'].includes(normalizedCycle)) {
      throw { status: 400, message: 'Invalid billing cycle. Allowed: MONTHLY, YEARLY.' };
    }

    if (!PLANS[upperPlanKey] || normalizedPlanKey === 'free') {
      throw { status: 400, message: 'Invalid subscription plan for purchase. Allowed plans: pro, premium.' };
    }

    // 1. Fetch Plan from Database (Source of Truth) and keep pricing synced
    const planConfig = PLANS[upperPlanKey];
    let dbPlan = await SubscriptionPlan.findOneAndUpdate(
      { planKey: normalizedPlanKey },
      {
        $set: {
          name: planConfig.name,
          planKey: planConfig.planKey,
          rank: planConfig.rank,
          price: planConfig.price,
          priceMonthly: planConfig.priceMonthly,
          priceYearly: planConfig.priceYearly,
          currency: planConfig.currency,
          generationLimit: planConfig.generationLimit,
          aiCreditsLimit: planConfig.aiCreditsLimit,
          features: planConfig.features,
          isActive: true,
          isPopular: planConfig.isPopular
        }
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Compute base price strictly from DB document with proper monthly & yearly support
    const baseAmount = computeOrderAmount(dbPlan, normalizedCycle);
    const currency = dbPlan.currency || 'INR';

    // 2. Validate Coupon Server-Side (Never trust client-supplied discount amounts)
    let validatedCoupon = null;
    let finalAmount = baseAmount;
    let discountAmount = 0;

    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      validatedCoupon = await couponService.validateCouponForCheckout({
        code: couponCode.trim(),
        userId,
        planKey: normalizedPlanKey,
        orderAmount: baseAmount
      });
      finalAmount = validatedCoupon.finalAmount;
      discountAmount = validatedCoupon.discountAmount;
    }

    // 3. Build Idempotency Key (incorporating coupon code to isolate coupon variants)
    let idempotencyKey = userSuppliedIdempotencyKey && userSuppliedIdempotencyKey.trim() !== ''
      ? userSuppliedIdempotencyKey.trim()
      : buildIdempotencyKey(userId, normalizedPlanKey, normalizedCycle, 60000);

    if (validatedCoupon) {
      idempotencyKey = `${idempotencyKey}_cpn_${validatedCoupon.couponCode}`;
    }

    // 4. Check for existing order
    let existingOrder = await PaymentOrder.findOne({ idempotencyKey });
    if (existingOrder) {
      // If already settled (PAID), return it
      if (existingOrder.status === 'PAID') {
        return {
          order: existingOrder,
          keyId: process.env.RAZORPAY_KEY_ID || '',
          isExisting: true
        };
      }

      // If pending with an active gateway order ID, return it
      if (existingOrder.status === 'PENDING' && existingOrder.gatewayOrderId) {
        return {
          order: existingOrder,
          keyId: process.env.RAZORPAY_KEY_ID || '',
          isExisting: true
        };
      }

      // If expired or cancelled, do NOT reuse dead order — renew idempotency key
      if (['EXPIRED', 'CANCELLED', 'FAILED'].includes(existingOrder.status)) {
        idempotencyKey = `${idempotencyKey}_retry_${Date.now()}`;
      }
    }

    // 5. Redis Mutex Lock to prevent duplicate concurrent gateway order generation
    const lockKey = `order_lock:${idempotencyKey}`;
    const lockAcquired = await this.acquireLock(lockKey, 10);

    if (!lockAcquired) {
      // Wait 500ms and re-fetch the order created by the parallel thread
      await new Promise((r) => setTimeout(r, 500));
      const parallelOrder = await PaymentOrder.findOne({ idempotencyKey });
      if (parallelOrder && parallelOrder.gatewayOrderId) {
        return {
          order: parallelOrder,
          keyId: process.env.RAZORPAY_KEY_ID || '',
          isExisting: true
        };
      }
    }

    try {
      // 6. Create or atomically acquire PaymentOrder in CREATED status
      let order;
      try {
        order = await PaymentOrder.findOneAndUpdate(
          { idempotencyKey },
          {
            $setOnInsert: {
              userId,
              planKey: normalizedPlanKey,
              planId: dbPlan._id,
              billingCycle: normalizedCycle,
              amount: finalAmount,
              originalAmount: baseAmount,
              discountAmount,
              couponCode: validatedCoupon ? validatedCoupon.couponCode : null,
              couponId: validatedCoupon ? validatedCoupon.couponId : null,
              currency,
              status: 'CREATED',
              gateway: 'RAZORPAY',
              notes: {
                ...notes,
                planName: dbPlan.name,
                billingCycle: normalizedCycle,
                couponCode: validatedCoupon ? validatedCoupon.couponCode : undefined,
                discountRupees: (discountAmount / 100).toFixed(2),
                createdVia: 'api/orders'
              }
            }
          },
          { upsert: true, returnDocument: 'after' }
        );
      } catch (err) {
        if (err.code === 11000) {
          order = await PaymentOrder.findOne({ idempotencyKey });
        } else {
          throw err;
        }
      }

      // If order is freshly created with coupon, atomically reserve redemption
      if (validatedCoupon && order.status === 'CREATED') {
        try {
          await couponService.applyCouponToOrder({
            order,
            couponCode: validatedCoupon.couponCode,
            userId
          });
        } catch (couponApplyErr) {
          order.status = 'CANCELLED';
          await order.save().catch(() => {});
          throw couponApplyErr;
        }
      }

      // 7. Call Razorpay API to generate the gateway order
      if (!order.gatewayOrderId || order.status === 'CREATED') {
        try {
          const rzpOrder = await razorpayService.createRazorpayOrder({
            amount: order.amount,
            currency: order.currency,
            receipt: `rcpt_${order._id.toString().slice(-12)}`,
            notes: {
              orderId: order._id.toString(),
              userId: userId.toString(),
              planKey: normalizedPlanKey,
              billingCycle: normalizedCycle,
              couponCode: order.couponCode || '',
              idempotencyKey
            }
          });

          order.gatewayOrderId = rzpOrder.id;
          order.status = 'PENDING';
          await order.save();
        } catch (rzpErr) {
          order.status = 'FAILED';
          await order.save().catch(() => {});
          if (order.couponCode) {
            await couponService.releaseCouponOnFailure({ orderId: order._id });
          }
          throw {
            status: 502,
            message: 'Unable to initiate payment with Razorpay. Please check connection or try again.',
            error: rzpErr.message
          };
        }
      }

      return {
        order,
        keyId: process.env.RAZORPAY_KEY_ID || '',
        isExisting: false
      };
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Validate a coupon code for a target plan & billing cycle
   */
  async validateCoupon({ code, userId, planKey, billingCycle = 'MONTHLY' }) {
    if (!planKey || typeof planKey !== 'string') {
      throw { status: 400, message: 'Plan key is required.' };
    }

    const normalizedPlanKey = planKey.trim().toLowerCase();
    const upperPlanKey = normalizedPlanKey.toUpperCase();
    const normalizedCycle = (billingCycle || 'MONTHLY').toUpperCase();

    if (!PLANS[upperPlanKey]) {
      throw { status: 400, message: 'Invalid plan specified.' };
    }

    const dbPlan = await SubscriptionPlan.findOne({ planKey: normalizedPlanKey });
    const baseAmount = dbPlan ? computeOrderAmount(dbPlan, normalizedCycle) : computeOrderAmount(PLANS[upperPlanKey], normalizedCycle);

    return await couponService.validateCouponForCheckout({
      code,
      userId,
      planKey: normalizedPlanKey,
      orderAmount: baseAmount
    });
  }

  /**
   * Get an order by ID (verifying user ownership)
   * @param {Object} params
   * @param {string} params.orderId
   * @param {string} params.userId
   * @param {boolean} params.isAdmin
   */
  async getOrderById({ orderId, userId, isAdmin = false }) {
    if (!orderId) {
      throw { status: 400, message: 'Order ID is required.' };
    }

    const order = await PaymentOrder.findById(orderId)
      .populate('userId', 'username email plan')
      .populate('planId', 'name planKey price features');

    if (!order) {
      throw { status: 404, message: 'Order not found.' };
    }

    const ownerId = order.userId?._id || order.userId;
    if (!isAdmin && (!ownerId || ownerId.toString() !== userId.toString())) {
      throw { status: 403, message: 'Access denied to this order.' };
    }

    return order;
  }
}

module.exports = new OrderService();
