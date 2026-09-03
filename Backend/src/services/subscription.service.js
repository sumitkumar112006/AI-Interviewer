const mongoose = require('mongoose');
const PaymentOrder = require('../models/paymentOrder.model');
const Payment = require('../models/payment.model');
const Subscription = require('../models/subscription.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');
const SubscriptionEvent = require('../models/subscriptionEvent.model');
const UsageTracking = require('../models/usageTracking.model');
const notificationModel = require('../models/notification.model');
const userModel = require('../models/user.model');
const invoiceService = require('./invoice.service');
const { PLANS } = require('../constants/plans.constants');

// Default plan ranks for dynamic upgrade/downgrade calculation
const DEFAULT_PLAN_RANKS = {
  free: 0,
  pro: 1,
  premium: 2
};

class SubscriptionService {
  /**
   * Activate or renew a subscription upon successful payment settlement.
   * Shared by both the Webhook receiver and the Reconciliation job.
   * Runs strictly inside a MongoDB transaction (No silent non-transactional fallback).
   * 
   * @param {Object} params
   * @param {string|mongoose.Types.ObjectId|Object} params.orderId Internal order ID or PaymentOrder doc
   * @param {string} params.gatewayPaymentId e.g., 'pay_xxxxxxxx'
   * @param {string} [params.gatewayOrderId] e.g., 'order_xxxxxxxx'
   * @param {string} [params.paymentMethod] e.g., 'upi', 'card'
   * @param {Object} [params.gatewayResponse] Redacted gateway response
   * @param {Date} [params.paidAt] Settlement timestamp
   * @param {mongoose.ClientSession} [params.existingSession] Optional passed session
   */
  async activate({
    orderId,
    gatewayPaymentId,
    gatewayOrderId,
    paymentMethod = 'unknown',
    gatewayResponse = {},
    paidAt = new Date(),
    existingSession = null
  }) {
    const session = existingSession || await mongoose.startSession();
    const sessionStartedLocally = !existingSession;

    const executeActivation = async (sess) => {
      // 1. Fetch the Order document
      let order = null;
      if (orderId && typeof orderId === 'object' && orderId.amount !== undefined && orderId.userId) {
        order = orderId;
      } else {
        const orderQuery = PaymentOrder.findById(orderId);
        if (sess) orderQuery.session(sess);
        order = await orderQuery;
      }

      if (!order) {
        throw new Error(`[SubscriptionService] PaymentOrder ${orderId} not found.`);
      }

      const normalizedPlanKey = (order.planKey || 'pro').toLowerCase();

      // Check if order was already processed to PAID (idempotency guard)
      if (order.status === 'PAID') {
        const paymentQ = Payment.findOne({ orderId: order._id });
        if (sess) paymentQ.session(sess);
        const existingPayment = await paymentQ;

        const subQ = Subscription.findOne({ userId: order.userId, status: 'ACTIVE' });
        if (sess) subQ.session(sess);
        const existingSub = await subQ;

        const { Invoice } = require('../models/invoice.model');
        const invQ = Invoice.findOne({ orderId: order._id });
        if (sess) invQ.session(sess);
        const existingInv = await invQ;

        return {
          alreadyProcessed: true,
          order,
          payment: existingPayment,
          subscription: existingSub,
          invoice: existingInv
        };
      }

      // Redact sensitive payload if any accidentally passed
      const sanitizedResponse = { ...gatewayResponse };
      delete sanitizedResponse.card_number;
      delete sanitizedResponse.cvv;
      delete sanitizedResponse.raw_card;

      // 2. Create or Upsert the Payment record (Idempotency check on gatewayPaymentId)
      const checkPaymentQ = Payment.findOne({ gatewayPaymentId });
      if (sess) checkPaymentQ.session(sess);
      let payment = await checkPaymentQ;

      if (!payment) {
        payment = new Payment({
          orderId: order._id,
          userId: order.userId,
          gatewayPaymentId,
          gatewayOrderId: gatewayOrderId || order.gatewayOrderId,
          amount: order.amount,
          currency: order.currency || 'INR',
          paymentMethod,
          status: 'SUCCESS',
          gatewayResponse: sanitizedResponse,
          paidAt: paidAt || new Date()
        });
        await payment.save({ session: sess });
      } else {
        payment.status = 'SUCCESS';
        payment.paidAt = paidAt || new Date();
        payment.gatewayResponse = sanitizedResponse;
        await payment.save({ session: sess });
      }

      // 3. Mark PaymentOrder as PAID
      order.status = 'PAID';
      if (gatewayOrderId) {
        order.gatewayOrderId = gatewayOrderId;
      }
      await order.save({ session: sess });

      // 4. Cancel any previous ACTIVE or GRACE_PERIOD subscriptions for this user
      // (Enforces the rule: strictly one active subscription per user)
      const findActiveSubsQ = Subscription.find({
        userId: order.userId,
        status: { $in: ['ACTIVE', 'GRACE_PERIOD'] }
      });
      if (sess) findActiveSubsQ.session(sess);
      const previousActiveSubs = await findActiveSubsQ;

      const previousPlanKey = previousActiveSubs.length > 0 ? previousActiveSubs[0].plan : 'free';

      for (const sub of previousActiveSubs) {
        sub.status = 'CANCELLED';
        sub.canceledAt = new Date();
        await sub.save({ session: sess });
      }

      // 5. Fetch plan limits and rank dynamically from DB SubscriptionPlan (fallback to constants)
      const planDocQ = SubscriptionPlan.findOne({ planKey: normalizedPlanKey, isActive: true });
      if (sess) planDocQ.session(sess);
      const planDoc = await planDocQ;

      const fallbackConfig = PLANS[normalizedPlanKey.toUpperCase()] || PLANS.PRO;
      const generationLimit = planDoc?.generationLimit ?? fallbackConfig.generationLimit;
      const aiCreditsLimit = planDoc?.aiCreditsLimit ?? fallbackConfig.aiCreditsLimit;
      const planDisplayName = planDoc?.name ?? fallbackConfig.name;

      // 6. Compute new subscription period
      const durationDays = order.billingCycle === 'YEARLY' ? 365 : 30;
      const now = new Date();
      const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // 7. Create the new ACTIVE Subscription
      const newSubscription = new Subscription({
        userId: order.userId,
        plan: normalizedPlanKey,
        planId: planDoc?._id || order.planId,
        status: 'ACTIVE',
        billingCycle: order.billingCycle || 'MONTHLY',
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd,
        cancelAtPeriodEnd: false
      });
      await newSubscription.save({ session: sess });

      // 8. Update User Profile (Tier, Generation Limits reset, and Expiry sync)
      await userModel.findByIdAndUpdate(
        order.userId,
        {
          plan: normalizedPlanKey,
          generationsUsed: 0,
          generationsResetAt: currentPeriodEnd
        },
        { session: sess }
      );

      // 9. Create Usage Tracking row for this billing period (linked to new subscription ID)
      const usageTracking = new UsageTracking({
        userId: order.userId,
        subscriptionId: newSubscription._id,
        plan: normalizedPlanKey,
        periodStart: now,
        periodEnd: currentPeriodEnd,
        interviewsUsed: 0,
        interviewsLimit: generationLimit,
        aiCreditsUsed: 0,
        aiCreditsLimit: aiCreditsLimit
      });
      await usageTracking.save({ session: sess });

      // 10. Dynamic Rank-Based SubscriptionEvent Determination
      const fromRank = DEFAULT_PLAN_RANKS[previousPlanKey] ?? 0;
      const toRank = planDoc?.rank ?? (DEFAULT_PLAN_RANKS[normalizedPlanKey] ?? 1);

      let eventType = 'ACTIVATED';
      if (previousPlanKey === 'free') {
        eventType = 'ACTIVATED';
      } else if (toRank > fromRank) {
        eventType = 'UPGRADED';
      } else if (toRank < fromRank) {
        eventType = 'DOWNGRADED';
      } else {
        eventType = 'RENEWED';
      }

      const subEvent = new SubscriptionEvent({
        userId: order.userId,
        subscriptionId: newSubscription._id,
        eventType,
        fromPlan: previousPlanKey,
        toPlan: normalizedPlanKey,
        paymentOrderId: order._id,
        paymentId: payment._id,
        metadata: {
          amount: order.amount,
          currency: order.currency,
          gatewayOrderId: order.gatewayOrderId,
          gatewayPaymentId,
          fromRank,
          toRank
        }
      });
      await subEvent.save({ session: sess });

      // 11. Generate immutable Invoice document (DB record only, fast inside transaction)
      const invoice = await invoiceService.generateInvoice({
        order,
        payment,
        subscription: newSubscription,
        session: sess
      });

      // 12. Send in-app notification to user
      const notif = new notificationModel({
        recipient: order.userId,
        title: `Plan Activated: ${planDisplayName} 🎉`,
        message: `Your ${planDisplayName} subscription is now active with ${generationLimit} mock interviews and ${aiCreditsLimit} AI credits until ${currentPeriodEnd.toLocaleDateString('en-IN')}.`,
        type: 'SUBSCRIPTION_ACTIVATED',
        metadata: {
          subscriptionId: newSubscription._id,
          orderId: order._id,
          invoiceNumber: invoice?.invoiceNumber
        }
      });
      await notif.save({ session: sess });

      return {
        alreadyProcessed: false,
        order,
        payment,
        subscription: newSubscription,
        invoice
      };
    };

    try {
      if (sessionStartedLocally) {
        let result;
        // Strictly execute inside MongoDB transaction. No silent non-transactional fallback.
        await session.withTransaction(async () => {
          result = await executeActivation(session);
        });
        return result;
      } else {
        return await executeActivation(existingSession);
      }
    } finally {
      if (sessionStartedLocally) {
        await session.endSession();
      }
    }
  }

  /**
   * Record a payment failure event from webhook or payment verification.
   * Fully idempotent against duplicate webhook failure deliveries.
   */
  async recordFailedPayment({
    orderId,
    gatewayPaymentId,
    gatewayOrderId,
    gatewayResponse = {},
    errorDetails = {},
    session = null
  }) {
    const orderQuery = PaymentOrder.findById(orderId);
    if (session) orderQuery.session(session);
    const order = await orderQuery;

    if (!order) {
      return null;
    }

    const failureId = gatewayPaymentId || `fail_${order._id}_${Date.now()}`;

    // Idempotency check: verify if this exact failed payment was already recorded
    const existingPaymentQ = Payment.findOne({ gatewayPaymentId: failureId });
    if (session) existingPaymentQ.session(session);
    const existingPayment = await existingPaymentQ;

    if (existingPayment) {
      console.log(`ℹ️ [SubscriptionService] Failed payment ${failureId} already recorded. Returning existing document.`);
      return existingPayment;
    }

    // Save failed payment record
    const payment = new Payment({
      orderId: order._id,
      userId: order.userId,
      gatewayPaymentId: failureId,
      gatewayOrderId: gatewayOrderId || order.gatewayOrderId,
      amount: order.amount,
      currency: order.currency || 'INR',
      status: 'FAILED',
      gatewayResponse,
      errorDetails
    });
    await payment.save({ session });

    // Notify user of payment failure
    const notif = new notificationModel({
      recipient: order.userId,
      title: 'Payment Failed ⚠️',
      message: 'Your recent subscription payment attempt could not be processed. Please retry or choose a different payment method.',
      type: 'PAYMENT_FAILED',
      metadata: {
        orderId: order._id,
        error: errorDetails
      }
    });
    await notif.save({ session });

    return payment;
  }

  /**
   * Get user subscription status and usage tracking (linking strictly to active subscription ID)
   */
  async getUserSubscriptionAndUsage(userId) {
    const activeSub = await Subscription.findOne({
      userId,
      status: 'ACTIVE'
    }).populate('planId');

    const user = await userModel.findById(userId).select('plan customBonusCredits customAiBonusCredits generationsUsed generationsResetAt');

    const currentPlanKey = activeSub?.plan || user?.plan || 'free';

    // Fetch dynamic plan document
    const planDoc = await SubscriptionPlan.findOne({ planKey: currentPlanKey, isActive: true });
    const fallbackConfig = PLANS[currentPlanKey.toUpperCase()] || PLANS.FREE;

    const generationLimit = planDoc?.generationLimit ?? fallbackConfig.generationLimit;
    const aiCreditsLimit = planDoc?.aiCreditsLimit ?? fallbackConfig.aiCreditsLimit;

    // Filter usage strictly by subscriptionId when active subscription exists
    let usage = null;
    if (activeSub?._id) {
      usage = await UsageTracking.findOne({
        userId,
        subscriptionId: activeSub._id
      }).sort({ periodStart: -1 });
    }

    if (!usage) {
      const now = new Date();
      usage = await UsageTracking.findOne({
        userId,
        periodEnd: { $gte: now }
      }).sort({ periodStart: -1 });
    }

    return {
      plan: currentPlanKey,
      planDetails: planDoc || fallbackConfig,
      subscription: activeSub || {
        status: 'ACTIVE',
        plan: 'free',
        currentPeriodEnd: user?.generationsResetAt || null
      },
      usage: {
        interviewsUsed: usage?.interviewsUsed ?? user?.generationsUsed ?? 0,
        interviewsLimit: usage?.interviewsLimit ?? generationLimit,
        aiCreditsUsed: usage?.aiCreditsUsed ?? 0,
        aiCreditsLimit: usage?.aiCreditsLimit ?? aiCreditsLimit,
        bonusCredits: user?.customBonusCredits ?? 0,
        aiBonusCredits: user?.customAiBonusCredits ?? 0
      }
    };
  }
}

module.exports = new SubscriptionService();
