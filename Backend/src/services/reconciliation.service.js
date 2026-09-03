const PaymentOrder = require('../models/paymentOrder.model');
const subscriptionService = require('./subscription.service');
const razorpayService = require('./razorpay.service');

class ReconciliationService {
  /**
   * Expire stale orders that have been in CREATED or PENDING status for > 30 minutes
   */
  async expireStaleOrders() {
    const thirtyMinCutoff = new Date(Date.now() - 30 * 60 * 1000);
    const oneDayCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    try {
      // 1. Abandoned orders that never generated a gatewayOrderId can be expired after 30 mins
      // 2. Orders with gatewayOrderId that remain pending/unpaid after the 24h reconciliation window can be expired
      const result = await PaymentOrder.updateMany(
        {
          status: { $in: ['CREATED', 'PENDING'] },
          $or: [
            {
              $or: [{ gatewayOrderId: { $exists: false } }, { gatewayOrderId: null }, { gatewayOrderId: '' }],
              createdAt: { $lte: thirtyMinCutoff }
            },
            {
              createdAt: { $lte: oneDayCutoff }
            }
          ]
        },
        {
          $set: { status: 'EXPIRED' }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`🧹 [OrderExpiryJob] Expired ${result.modifiedCount} abandoned orders.`);
      }
      return { expiredCount: result.modifiedCount };
    } catch (err) {
      console.error('❌ [OrderExpiryJob] Error expiring orders:', err.message);
      return { error: err.message };
    }
  }

  /**
   * Reconcile pending orders against Razorpay API to catch missed webhook deliveries.
   * Scans orders created between 10 and 60 minutes ago.
   */
  async reconcilePendingOrders() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const pendingOrders = await PaymentOrder.find({
        status: { $in: ['CREATED', 'PENDING'] },
        gatewayOrderId: { $exists: true, $ne: null },
        createdAt: { $gte: oneDayAgo, $lte: tenMinutesAgo }
      });

      console.log(`🔍 [ReconciliationJob] Checking ${pendingOrders.length} pending orders for gateway settlement...`);
      const results = {
        checked: pendingOrders.length,
        activated: 0,
        expired: 0,
        unchanged: 0,
        errors: 0
      };

      for (const order of pendingOrders) {
        try {
          const rzpOrder = await razorpayService.fetchRazorpayOrder(order.gatewayOrderId);
          if (!rzpOrder) {
            // Order doesn't exist on gateway
            order.status = 'EXPIRED';
            await order.save();
            results.expired++;
            console.log(`⚠️ [ReconciliationJob] Order ${order.gatewayOrderId} not found on gateway. Marked EXPIRED.`);
            continue;
          }

          if (rzpOrder.status === 'paid' || rzpOrder.amount_paid >= order.amount) {
            // Fetch the payment details from Razorpay
            const payments = await razorpayService.fetchOrderPayments(order.gatewayOrderId);
            const successfulPayment = payments.items?.find(p => p.status === 'captured') || payments.items?.[0] || {};

            console.log(`⚡ [ReconciliationJob] Missed webhook recovered! Settling order ${order._id} (Gateway: ${order.gatewayOrderId}).`);

            await subscriptionService.activate({
              orderId: order._id,
              gatewayPaymentId: successfulPayment.id || `rec_${Date.now()}`,
              gatewayOrderId: order.gatewayOrderId,
              paymentMethod: successfulPayment.method || 'reconciled_gateway',
              gatewayResponse: {
                reconciled: true,
                rzpOrder,
                payment: successfulPayment
              },
              paidAt: successfulPayment.created_at ? new Date(successfulPayment.created_at * 1000) : new Date()
            });

            results.activated++;
          } else if (['attempted', 'created'].includes(rzpOrder.status)) {
            // Still in progress or awaiting retry
            results.unchanged++;
          } else {
            // Failed or expired on gateway
            order.status = 'EXPIRED';
            await order.save();
            results.expired++;
          }
        } catch (itemErr) {
          console.error(`❌ [ReconciliationJob] Error checking order ${order._id}:`, itemErr.message);
          results.errors++;
        }
      }

      console.log(`📊 [ReconciliationJob] Completed: ${JSON.stringify(results)}`);
      return results;
    } catch (err) {
      console.error('❌ [ReconciliationJob] Fatal error:', err.message);
      return { error: err.message };
    }
  }

  /**
   * Start recurring background timer in long-running Node process
   */
  startBackgroundCron() {
    console.log('⏱️ [PaymentCron] Starting scheduled order expiry & reconciliation background jobs.');
    
    // Run order expiry every 15 minutes
    setInterval(() => {
      this.expireStaleOrders().catch(() => {});
    }, 15 * 60 * 1000);

    // Run reconciliation every 10 minutes
    setInterval(() => {
      this.reconcilePendingOrders().catch(() => {});
    }, 10 * 60 * 1000);
  }
}

module.exports = new ReconciliationService();
