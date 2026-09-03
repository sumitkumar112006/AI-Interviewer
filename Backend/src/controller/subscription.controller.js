const subscriptionService = require('../services/subscription.service');
const razorpayService = require('../services/razorpay.service');
const PaymentOrder = require('../models/paymentOrder.model');

class SubscriptionController {
  /**
   * GET /api/subscriptions/me
   * Retrieve current user's active subscription, tier, limits, and usage
   */
  async getMySubscription(req, res, next) {
    try {
      const userId = req.user.id;
      const data = await subscriptionService.getUserSubscriptionAndUsage(userId);

      return res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/subscriptions/verify-client-payment
   * Verifies Razorpay checkout signature and provides immediate plan activation
   */
  async verifyClientPayment(req, res, next) {
    try {
      const userId = req.user.id;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing required Razorpay payment verification fields.'
        });
      }

      // 1. Verify cryptographic signature
      const isValid = razorpayService.verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
      });

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Payment signature verification failed. Tampered or invalid transaction.'
        });
      }

      // 2. Find matching order strictly bound to razorpay_order_id
      let order = null;
      if (orderId) {
        order = await PaymentOrder.findById(orderId);
      }
      if (!order) {
        order = await PaymentOrder.findOne({ gatewayOrderId: razorpay_order_id });
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Matching payment order not found.'
        });
      }

      // Assert that order.gatewayOrderId strictly matches the verified razorpay_order_id
      if (order.gatewayOrderId !== razorpay_order_id) {
        return res.status(400).json({
          success: false,
          message: 'Gateway order ID does not match the specified order.'
        });
      }

      // Verify user ownership
      if (order.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized payment verification attempt.'
        });
      }

      // 3. Atomically activate subscription (handles idempotent replay safely)
      const result = await subscriptionService.activate({
        orderId: order._id,
        gatewayPaymentId: razorpay_payment_id,
        gatewayOrderId: razorpay_order_id,
        paymentMethod: 'razorpay_checkout',
        gatewayResponse: {
          razorpay_order_id,
          razorpay_payment_id,
          verifiedVia: 'client_signature'
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Payment verified and subscription activated successfully!',
        data: {
          plan: order.planKey,
          subscriptionId: result.subscription?._id,
          invoiceNumber: result.invoice?.invoiceNumber,
          currentPeriodEnd: result.subscription?.currentPeriodEnd
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SubscriptionController();
