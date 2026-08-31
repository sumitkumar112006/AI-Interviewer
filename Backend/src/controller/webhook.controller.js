const WebhookEvent = require('../models/webhookEvent.model');
const PaymentOrder = require('../models/paymentOrder.model');
const Payment = require('../models/payment.model');
const Refund = require('../models/refund.model');
const razorpayService = require('../services/razorpay.service');
const subscriptionService = require('../services/subscription.service');
const { decideRefundStatus, decideWebhookAction } = require('../services/paymentLogic');

class WebhookController {
  /**
   * POST /api/webhooks/razorpay
   * Handles incoming Razorpay webhook events with signature verification & strict idempotency.
   */
  async handleRazorpayWebhook(req, res) {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || req.body;

    // 1. Signature Verification
    if (!signature) {
      console.warn('⚠️ [Webhook] Missing x-razorpay-signature header.');
      return res.status(400).json({ error: 'Missing signature header' });
    }

    try {
      const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        console.warn('❌ [Webhook] Invalid Razorpay webhook signature.');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    } catch (err) {
      console.error('❌ [Webhook] Error verifying webhook signature:', err.message);
      return res.status(400).json({ error: err.message });
    }

    // Parse payload
    let payload;
    try {
      payload = Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString('utf8')) : (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody);
    } catch (parseErr) {
      console.error('❌ [Webhook] JSON parse error on raw body:', parseErr.message);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const eventType = payload.event;
    // Strict event ID check: never synthesize a random Date.now() ID that could bypass duplicate guards
    const gatewayEventId = req.headers['x-razorpay-event-id'] || payload.id || payload.event_id;
    if (!gatewayEventId) {
      console.warn('⚠️ [Webhook] Rejected webhook with missing gateway event ID.');
      return res.status(400).json({ error: 'Missing gateway event ID' });
    }

    console.log(`📥 [Webhook] Received Razorpay event: [${eventType}] (Event ID: ${gatewayEventId})`);

    // 2. Primary Idempotency Guard: Insert into WebhookEvent with compound unique index (gateway, gatewayEventId)
    let webhookEvent;
    try {
      webhookEvent = await WebhookEvent.create({
        gateway: 'RAZORPAY',
        gatewayEventId,
        eventType,
        rawPayload: payload,
        signatureVerified: true,
        processingStatus: 'PENDING'
      });
    } catch (dbErr) {
      // E11000 Duplicate Key Error means this exact webhook event was already delivered
      if (dbErr.code === 11000) {
        console.log(`🔁 [Webhook] Duplicate webhook event ${gatewayEventId} already recorded. Responding 200 OK.`);
        return res.status(200).json({ status: 'ok', message: 'Duplicate event ignored' });
      }
      console.error('❌ [Webhook] Database error recording webhook event:', dbErr);
      return res.status(500).json({ error: 'Internal database error' });
    }

    // Extract relevant payload objects
    const paymentEntity = payload.payload?.payment?.entity || {};
    const orderEntity = payload.payload?.order?.entity || {};
    const refundEntity = payload.payload?.refund?.entity || {};

    const gatewayOrderId = paymentEntity.order_id || orderEntity.id;
    const gatewayPaymentId = paymentEntity.id;

    try {
      // Find matching internal order
      let order = null;
      if (gatewayOrderId) {
        order = await PaymentOrder.findOne({ gatewayOrderId });
        if (order) {
          webhookEvent.relatedOrderId = order._id;
        }
      }

      // 3. Evaluate Decision Logic
      const action = decideWebhookAction({
        webhookEventAlreadyExists: false,
        order,
        eventType
      });

      if (action === 'UNKNOWN_ORDER') {
        console.warn(`⚠️ [Webhook] No local PaymentOrder found for gatewayOrderId: ${gatewayOrderId}`);
        webhookEvent.processingStatus = 'IGNORED';
        webhookEvent.processingError = 'Order not found';
        await webhookEvent.save();
        return res.status(200).json({ status: 'ok', message: 'Order not found' });
      }

      if (action === 'IGNORE_SETTLED') {
        console.log(`ℹ️ [Webhook] Order ${order._id} already settled as PAID. Skipping activation.`);
        webhookEvent.processingStatus = 'IGNORED';
        await webhookEvent.save();
        return res.status(200).json({ status: 'ok', message: 'Order already settled' });
      }

      switch (eventType) {
        case 'payment.captured':
        case 'order.paid': {
          // Activate subscription atomically
          const result = await subscriptionService.activate({
            orderId: order._id,
            gatewayPaymentId,
            gatewayOrderId,
            paymentMethod: paymentEntity.method || 'unknown',
            gatewayResponse: {
              id: paymentEntity.id,
              status: paymentEntity.status,
              method: paymentEntity.method,
              bank: paymentEntity.bank,
              wallet: paymentEntity.wallet,
              vpa: paymentEntity.vpa,
              email: paymentEntity.email,
              contact: paymentEntity.contact
            },
            paidAt: paymentEntity.created_at ? new Date(paymentEntity.created_at * 1000) : new Date()
          });

          if (result.payment) {
            webhookEvent.relatedPaymentId = result.payment._id;
          }

          webhookEvent.processingStatus = 'PROCESSED';
          webhookEvent.processedAt = new Date();
          await webhookEvent.save();
          console.log(`✅ [Webhook] Successfully processed ${eventType} for order ${order._id}`);
          break;
        }

        case 'payment.failed': {
          if (order) {
            await subscriptionService.recordFailedPayment({
              orderId: order._id,
              gatewayPaymentId,
              gatewayOrderId,
              gatewayResponse: {
                id: paymentEntity.id,
                error_code: paymentEntity.error_code,
                error_description: paymentEntity.error_description,
                error_source: paymentEntity.error_source,
                error_step: paymentEntity.error_step,
                error_reason: paymentEntity.error_reason
              },
              errorDetails: {
                code: paymentEntity.error_code,
                description: paymentEntity.error_description,
                reason: paymentEntity.error_reason
              }
            });
          }

          webhookEvent.processingStatus = 'PROCESSED';
          webhookEvent.processedAt = new Date();
          await webhookEvent.save();
          console.log(`⚠️ [Webhook] Recorded payment failure for gatewayOrderId ${gatewayOrderId}`);
          break;
        }

        case 'refund.processed': {
          const refundAmount = refundEntity.amount; // in paise
          const gatewayRefundId = refundEntity.id;

          let payment = await Payment.findOne({ gatewayPaymentId });
          if (!payment && order) {
            payment = await Payment.findOne({ orderId: order._id });
          }

          if (payment) {
            webhookEvent.relatedPaymentId = payment._id;

            // Create or update Refund document
            await Refund.findOneAndUpdate(
              { gatewayRefundId },
              {
                paymentId: payment._id,
                orderId: order?._id || payment.orderId,
                userId: payment.userId,
                gatewayRefundId,
                amount: refundAmount,
                currency: refundEntity.currency || 'INR',
                reason: refundEntity.notes?.reason || 'Customer refund',
                status: 'PROCESSED',
                gatewayResponse: refundEntity,
                processedAt: new Date()
              },
              { upsert: true, returnDocument: 'after' }
            );

            // Compute cumulative refunded amount across all processed refunds for this payment
            const totalRefundedAgg = await Refund.aggregate([
              { $match: { paymentId: payment._id, status: 'PROCESSED' } },
              { $group: { _id: null, sum: { $sum: '$amount' } } }
            ]);

            const cumulativeRefunded = totalRefundedAgg[0]?.sum || refundAmount;
            const updatedStatus = decideRefundStatus(payment.amount, cumulativeRefunded) || 'PARTIALLY_REFUNDED';

            payment.status = updatedStatus;
            await payment.save();
            console.log(`💸 [Webhook] Processed refund for payment ${payment._id} (Cumulative: ₹${cumulativeRefunded/100}, Status: ${payment.status})`);
          }

          webhookEvent.processingStatus = 'PROCESSED';
          webhookEvent.processedAt = new Date();
          await webhookEvent.save();
          break;
        }

        default:
          console.log(`ℹ️ [Webhook] Unhandled event type: ${eventType}`);
          webhookEvent.processingStatus = 'IGNORED';
          await webhookEvent.save();
          break;
      }

      // Always return 200 once durably recorded
      return res.status(200).json({ status: 'ok' });
    } catch (procErr) {
      console.error(`❌ [Webhook] Error processing event ${gatewayEventId}:`, procErr);
      webhookEvent.processingStatus = 'FAILED';
      webhookEvent.processingError = procErr.message;
      await webhookEvent.save().catch(() => {});
      // Return 200 so gateway does not continuously spam while error is logged
      return res.status(200).json({ status: 'error_logged', error: procErr.message });
    }
  }
}

module.exports = new WebhookController();
