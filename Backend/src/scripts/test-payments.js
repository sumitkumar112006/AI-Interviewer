/**
 * Integration Test Suite for Production-Grade Payment Layer
 * 
 * Verifies:
 * 1. Order creation idempotency & Yearly billing cycle
 * 2. Single active subscription constraint (partial unique index test)
 * 3. Webhook duplicate delivery (same gatewayEventId ignored via unique compound index)
 * 4. Subscription activation & double settlement protection
 * 5. Payment failure handling & failure idempotency (no subscription activated, duplicate failure handled safely)
 * 6. Missed-webhook recovery via ReconciliationService
 * 7. Dynamic rank-based subscription event auditing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectToDB = require('../config/database');
const PaymentOrder = require('../models/paymentOrder.model');
const Payment = require('../models/payment.model');
const WebhookEvent = require('../models/webhookEvent.model');
const Subscription = require('../models/subscription.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');
const SubscriptionEvent = require('../models/subscriptionEvent.model');
const { Invoice } = require('../models/invoice.model');
const UsageTracking = require('../models/usageTracking.model');
const userModel = require('../models/user.model');
const orderService = require('../services/order.service');
const subscriptionService = require('../services/subscription.service');
const reconciliationService = require('../services/reconciliation.service');
const razorpayService = require('../services/razorpay.service');

async function runTests() {
  console.log('🧪 Starting Payment Integration Tests...\n');
  await connectToDB();

  // Sync schema indexes with MongoDB
  await Subscription.syncIndexes();
  await WebhookEvent.syncIndexes();
  await PaymentOrder.syncIndexes();

  // Seed plans with ranks, monthly and yearly prices
  await SubscriptionPlan.findOneAndUpdate(
    { planKey: 'free' },
    { name: 'Free', planKey: 'free', rank: 0, price: 0, priceMonthly: 0, priceYearly: 0, generationLimit: 3, aiCreditsLimit: 20, isActive: true },
    { upsert: true, returnDocument: 'after' }
  );
  await SubscriptionPlan.findOneAndUpdate(
    { planKey: 'pro' },
    { name: 'Pro', planKey: 'pro', rank: 1, price: 19900, priceMonthly: 19900, priceYearly: 199000, generationLimit: 10, aiCreditsLimit: 50, isActive: true },
    { upsert: true, returnDocument: 'after' }
  );
  await SubscriptionPlan.findOneAndUpdate(
    { planKey: 'premium' },
    { name: 'Premium', planKey: 'premium', rank: 2, price: 39900, priceMonthly: 39900, priceYearly: 399000, generationLimit: 25, aiCreditsLimit: 100, isActive: true },
    { upsert: true, returnDocument: 'after' }
  );

  const testEmail = `test_pay_${Date.now()}@example.com`;
  let testUser = await userModel.create({
    username: `testuser_${Date.now()}`,
    email: testEmail,
    password: 'Password123!',
    plan: 'free',
    isVerified: true
  });

  const userId = testUser._id.toString();
  console.log(`👤 Created Test User: ${userId} (${testEmail})`);

  let testsPassed = 0;
  let testsTotal = 7;

  try {
    // -----------------------------------------------------------------------
    // TEST 1: Order Creation Idempotency & Yearly Pricing Calculation
    // -----------------------------------------------------------------------
    console.log('\n--- [TEST 1] Order Creation Idempotency & Yearly Pricing ---');
    const customKey = `idem_key_${Date.now()}`;
    const order1 = await orderService.createOrder({
      userId,
      planKey: 'pro',
      billingCycle: 'MONTHLY',
      userSuppliedIdempotencyKey: customKey
    });

    const order2 = await orderService.createOrder({
      userId,
      planKey: 'pro',
      billingCycle: 'MONTHLY',
      userSuppliedIdempotencyKey: customKey
    });

    const yearlyOrder = await orderService.createOrder({
      userId,
      planKey: 'premium',
      billingCycle: 'YEARLY'
    });

    if (
      order1.order._id.toString() === order2.order._id.toString() &&
      order2.isExisting === true &&
      order1.order.amount === 19900 &&
      yearlyOrder.order.amount === 399000
    ) {
      console.log('✅ PASS: Duplicate order calls collapsed to same document, and Yearly order computed ₹3,990 (399000 paise).');
      testsPassed++;
    } else {
      console.error('❌ FAIL: Order idempotency or yearly price calculation failed.');
    }

    // -----------------------------------------------------------------------
    // TEST 2: Single Active Subscription Unique Index Constraint
    // -----------------------------------------------------------------------
    console.log('\n--- [TEST 2] Single Active Subscription Partial Unique Index ---');
    await Subscription.deleteMany({ userId });
    
    // Create first active subscription
    await Subscription.create({
      userId,
      plan: 'pro',
      status: 'ACTIVE',
      startedAt: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    let duplicateIndexCaught = false;
    try {
      // Attempting to create a second active subscription must throw E11000 duplicate key error
      await Subscription.create({
        userId,
        plan: 'premium',
        status: 'ACTIVE',
        startedAt: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    } catch (err) {
      if (err.code === 11000 || err.message?.includes('duplicate key') || err.message?.includes('E11000')) {
        duplicateIndexCaught = true;
      }
    }

    if (duplicateIndexCaught) {
      console.log('✅ PASS: Second active subscription was rejected by database unique partial index.');
      testsPassed++;
    } else {
      console.error('❌ FAIL: Database allowed two simultaneous active subscriptions for the same user.');
    }

    // -----------------------------------------------------------------------
    // TEST 3: Duplicate Webhook Delivery (Same gatewayEventId)
    // -----------------------------------------------------------------------
    console.log('\n--- [TEST 3] Duplicate Webhook Delivery Idempotency ---');
    const eventId = `evt_test_${Date.now()}`;
    await WebhookEvent.create({
      gateway: 'RAZORPAY',
      gatewayEventId: eventId,
      eventType: 'payment.captured',
      rawPayload: { test: true },
      signatureVerified: true,
      processingStatus: 'PROCESSED'
    });

    let duplicateWebhookRejected = false;
    try {
      await WebhookEvent.create({
        gateway: 'RAZORPAY',
        gatewayEventId: eventId,
        eventType: 'payment.captured',
        rawPayload: { test: true },
        signatureVerified: true,
        processingStatus: 'PROCESSED'
      });
    } catch (whErr) {
      if (whErr.code === 11000 || whErr.message?.includes('duplicate key')) {
        duplicateWebhookRejected = true;
      }
    }

    if (duplicateWebhookRejected) {
      console.log('✅ PASS: Duplicate webhook delivery was immediately rejected by compound unique index (gateway, gatewayEventId).');
      testsPassed++;
    } else {
      console.error('❌ FAIL: Duplicate webhook event was not blocked at DB level.');
    }

    // -----------------------------------------------------------------------
    // TEST 4: Subscription Activation & Double-Settlement Protection
    // -----------------------------------------------------------------------
    console.log('\n--- [TEST 4] Subscription Activation & Double Settlement Protection ---');
    const settleOrder = await PaymentOrder.create({
      userId,
      planKey: 'pro',
      amount: 19900,
      currency: 'INR',
      status: 'PENDING',
      gateway: 'RAZORPAY',
      gatewayOrderId: `order_settle_${Date.now()}`,
      idempotencyKey: `settle_key_${Date.now()}`
    });

    const r1 = await subscriptionService.activate({
      orderId: settleOrder._id,
      gatewayPaymentId: `pay_settle_1_${Date.now()}`,
      gatewayOrderId: settleOrder.gatewayOrderId,
      paymentMethod: 'upi',
      paidAt: new Date()
    });

    const r2 = await subscriptionService.activate({
      orderId: settleOrder._id,
      gatewayPaymentId: `pay_settle_2_${Date.now()}`,
      gatewayOrderId: settleOrder.gatewayOrderId,
      paymentMethod: 'card',
      paidAt: new Date()
    });

    const invoiceCount = await Invoice.countDocuments({ orderId: settleOrder._id });

    if (r1.alreadyProcessed === false && r2.alreadyProcessed === true && invoiceCount === 1) {
      console.log(`✅ PASS: First activation succeeded (Invoice: ${r1.invoice.invoiceNumber}), second attempt safely returned alreadyProcessed with exactly 1 invoice.`);
      testsPassed++;
    } else {
      console.error(`❌ FAIL: Double settlement protection failed. Invoices count: ${invoiceCount}`);
    }

    // -----------------------------------------------------------------------
    // TEST 5: Payment Failure Handling & Failure Idempotency
    // -----------------------------------------------------------------------
    console.log('\n--- [TEST 5] Payment Failure Handling & Duplicate Failure Idempotency ---');
    const failOrder = await PaymentOrder.create({
      userId,
      planKey: 'premium',
      amount: 39900,
      currency: 'INR',
      status: 'PENDING',
      gateway: 'RAZORPAY',
      gatewayOrderId: `order_fail_${Date.now()}`,
      idempotencyKey: `fail_key_${Date.now()}`
    });

    const failPaymentId = `pay_failed_${Date.now()}`;
    const fail1 = await subscriptionService.recordFailedPayment({
      orderId: failOrder._id,
      gatewayPaymentId: failPaymentId,
      gatewayOrderId: failOrder.gatewayOrderId,
      gatewayResponse: { error_code: 'BAD_REQUEST_ERROR', error_description: 'Payment cancelled' },
      errorDetails: { code: 'PAYMENT_CANCELLED' }
    });

    // Double delivery of failure with same gatewayPaymentId must not crash with duplicate key
    const fail2 = await subscriptionService.recordFailedPayment({
      orderId: failOrder._id,
      gatewayPaymentId: failPaymentId,
      gatewayOrderId: failOrder.gatewayOrderId,
      gatewayResponse: { error_code: 'BAD_REQUEST_ERROR', error_description: 'Payment cancelled' },
      errorDetails: { code: 'PAYMENT_CANCELLED' }
    });

    const userAfterFail = await userModel.findById(userId);
    if (fail1.status === 'FAILED' && fail2.status === 'FAILED' && userAfterFail.plan === 'pro') {
      console.log('✅ PASS: Failed payment was recorded with status FAILED, duplicate failure delivery handled cleanly without duplicate key crash, and user was NOT upgraded.');
      testsPassed++;
    } else {
      console.error('❌ FAIL: Failed payment affected user subscription state or crashed on duplicate.');
    }

    // -----------------------------------------------------------------------
    // TEST 6: Missed Webhook Recovery via Reconciliation
    // -----------------------------------------------------------------------
    console.log('\n--- [TEST 6] Missed Webhook Recovery via Reconciliation ---');
    const missedOrder = await PaymentOrder.create({
      userId,
      planKey: 'premium',
      amount: 39900,
      currency: 'INR',
      status: 'PENDING',
      gateway: 'RAZORPAY',
      gatewayOrderId: `order_missed_${Date.now()}`,
      idempotencyKey: `missed_key_${Date.now()}`,
      createdAt: new Date(Date.now() - 15 * 60 * 1000) // 15 mins old
    });

    // Mock Razorpay service fetch
    const origFetchOrder = razorpayService.fetchRazorpayOrder;
    const origFetchPayments = razorpayService.fetchOrderPayments;

    razorpayService.fetchRazorpayOrder = async (orderId) => {
      if (orderId === missedOrder.gatewayOrderId) {
        return { id: orderId, status: 'paid', amount_paid: 39900 };
      }
      return null;
    };

    razorpayService.fetchOrderPayments = async (orderId) => {
      return {
        items: [{ id: `pay_rec_${Date.now()}`, status: 'captured', method: 'upi', created_at: Math.floor(Date.now() / 1000) }]
      };
    };

    const recResult = await reconciliationService.reconcilePendingOrders();
    const updatedMissedOrder = await PaymentOrder.findById(missedOrder._id);
    const updatedUser = await userModel.findById(userId);

    // Restore original methods
    razorpayService.fetchRazorpayOrder = origFetchOrder;
    razorpayService.fetchOrderPayments = origFetchPayments;

    if (updatedMissedOrder.status === 'PAID' && updatedUser.plan === 'premium' && recResult.activated >= 1) {
      console.log('✅ PASS: Missed webhook was automatically recovered and user subscription upgraded to Premium.');
      testsPassed++;
    } else {
      console.error('❌ FAIL: Reconciliation job failed to recover missed webhook.');
    }

    // -----------------------------------------------------------------------
    // TEST 7: Dynamic Rank-Based Audit Events (UPGRADE & DOWNGRADE)
    // -----------------------------------------------------------------------
    console.log('\n--- [TEST 7] Dynamic Rank-Based Upgrade / Downgrade Audit Trail ---');
    const upgradeEvent = await SubscriptionEvent.findOne({ userId, toPlan: 'premium' }).sort({ createdAt: -1 });
    
    if (upgradeEvent && upgradeEvent.eventType === 'UPGRADED' && upgradeEvent.fromPlan === 'pro') {
      console.log('✅ PASS: Rank-based event dynamically classified Pro -> Premium transition as UPGRADED.');
      testsPassed++;
    } else {
      console.error('❌ FAIL: Event classification failed:', upgradeEvent);
    }

  } catch (testErr) {
    console.error('💥 Test Execution Error:', testErr);
  } finally {
    // Cleanup test data
    console.log('\n🧹 Cleaning up test artifacts...');
    await userModel.findByIdAndDelete(userId);
    await PaymentOrder.deleteMany({ userId });
    await Payment.deleteMany({ userId });
    await Subscription.deleteMany({ userId });
    await SubscriptionEvent.deleteMany({ userId });
    await UsageTracking.deleteMany({ userId });
    await Invoice.deleteMany({ userId });

    console.log(`\n🏁 Test Results: ${testsPassed} / ${testsTotal} Passed!`);
    await mongoose.disconnect();
    process.exit(testsPassed === testsTotal ? 0 : 1);
  }
}

runTests();
