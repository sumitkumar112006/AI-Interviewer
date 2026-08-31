const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Payment Schema — one settled attempt against an order
 */
const paymentSchema = new Schema({
  orderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'PaymentOrder', 
    required: true, 
    index: true 
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'users', 
    required: true, 
    index: true 
  },
  gatewayPaymentId: { 
    type: String, 
    unique: true, 
    sparse: true 
  }, // e.g. razorpay_payment_id
  gatewayOrderId: {
    type: String,
    index: true
  }, // e.g. razorpay_order_id
  gatewaySignature: {
    type: String
  },
  amount: { 
    type: Number, 
    required: true 
  }, // in paise
  currency: { 
    type: String, 
    required: true, 
    default: 'INR' 
  },
  paymentMethod: {
    type: String // 'upi', 'card', 'netbanking', 'wallet'
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
    default: 'PENDING', 
    index: true,
  },
  gatewayResponse: { 
    type: Schema.Types.Mixed 
  }, // never store raw sensitive card details
  errorDetails: {
    type: Schema.Types.Mixed
  },
  paidAt: {
    type: Date
  },
}, { timestamps: true });

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

module.exports = Payment;
