const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Refund Schema — tracks refund attempts and processed refunds
 */
const refundSchema = new Schema({
  paymentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Payment', 
    required: true, 
    index: true 
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'PaymentOrder'
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  gatewayRefundId: { 
    type: String, 
    unique: true, 
    sparse: true 
  },
  amount: { 
    type: Number, 
    required: true 
  }, // in paise
  currency: {
    type: String,
    default: 'INR'
  },
  reason: {
    type: String
  },
  status: { 
    type: String, 
    enum: ['PENDING', 'PROCESSED', 'FAILED', 'REJECTED'], 
    default: 'PENDING',
    index: true
  },
  gatewayResponse: {
    type: Schema.Types.Mixed
  },
  processedAt: {
    type: Date
  },
}, { timestamps: true });

const Refund = mongoose.models.Refund || mongoose.model('Refund', refundSchema);

module.exports = Refund;
