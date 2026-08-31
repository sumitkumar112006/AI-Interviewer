const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * WebhookEvent Schema — the idempotency backbone for gateway webhooks
 */
const webhookEventSchema = new Schema({
  gateway: { 
    type: String, 
    required: true,
    default: 'RAZORPAY'
  },
  gatewayEventId: { 
    type: String, 
    required: true 
  }, // e.g. x-razorpay-event-id
  eventType: { 
    type: String, 
    required: true 
  }, // e.g. payment.captured, payment.failed, order.paid
  relatedOrderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'PaymentOrder' 
  },
  relatedPaymentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Payment' 
  },
  rawPayload: { 
    type: Schema.Types.Mixed, 
    required: true 
  },
  signatureVerified: { 
    type: Boolean, 
    default: false 
  },
  processingStatus: {
    type: String,
    enum: ['PENDING', 'PROCESSED', 'FAILED', 'IGNORED'],
    default: 'PENDING', 
    index: true,
  },
  processingError: {
    type: String
  },
  processedAt: {
    type: Date
  },
  retryCount: { 
    type: Number, 
    default: 0 
  },
}, { timestamps: true });

// THE idempotency guard: guarantees duplicate webhooks are rejected at DB level
webhookEventSchema.index({ gateway: 1, gatewayEventId: 1 }, { unique: true });

const WebhookEvent = mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', webhookEventSchema);

module.exports = WebhookEvent;
