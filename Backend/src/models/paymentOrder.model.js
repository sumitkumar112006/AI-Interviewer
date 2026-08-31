const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * PaymentOrder Schema
 * Created server-side before initiating a payment gateway order (Razorpay).
 * Holds the validated server-side order price and transaction state.
 */
const paymentOrderSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'users', 
    required: true, 
    index: true 
  },
  planKey: {
    type: String,
    enum: ['free', 'pro', 'premium'],
    required: true
  },
  planId: { 
    type: Schema.Types.ObjectId, 
    ref: 'SubscriptionPlan'
  },
  billingCycle: {
    type: String,
    enum: ['MONTHLY', 'YEARLY'],
    default: 'MONTHLY'
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 1 
  }, // minor currency units (paise, e.g., 19900 = ₹199.00, 34900 = ₹349.00)
  currency: { 
    type: String, 
    required: true, 
    default: 'INR', 
    minlength: 3, 
    maxlength: 3 
  },
  status: {
    type: String,
    enum: ['CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'],
    default: 'CREATED', 
    index: true,
  },
  gateway: { 
    type: String, 
    required: true,
    default: 'RAZORPAY'
  }, // 'RAZORPAY', 'STRIPE', ...
  gatewayOrderId: { 
    type: String, 
    unique: true, 
    sparse: true 
  },
  idempotencyKey: { 
    type: String, 
    required: true, 
    unique: true 
  },
  notes: {
    type: Schema.Types.Mixed
  }
}, { timestamps: true });

const PaymentOrder = mongoose.models.PaymentOrder || mongoose.model('PaymentOrder', paymentOrderSchema);

module.exports = PaymentOrder;
