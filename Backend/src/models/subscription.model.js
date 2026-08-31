const mongoose = require('mongoose');
const { Schema } = mongoose;

const subscriptionSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'users', 
    required: true, 
    index: true 
  },
  plan: { 
    type: String, 
    enum: ['free', 'pro', 'premium'], 
    required: true 
  },
  planId: { 
    type: Schema.Types.ObjectId, 
    ref: 'SubscriptionPlan' 
  },
  status: { 
    type: String, 
    enum: ['ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE', 'GRACE_PERIOD'], 
    default: 'ACTIVE',
    set: (v) => (typeof v === 'string' ? v.toUpperCase() : v),
    index: true 
  },
  billingCycle: {
    type: String,
    enum: ['MONTHLY', 'YEARLY'],
    default: 'MONTHLY'
  },
  startedAt: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  currentPeriodStart: {
    type: Date,
    default: Date.now
  },
  currentPeriodEnd: { 
    type: Date, 
    required: true, 
    index: true 
  },
  cancelAtPeriodEnd: { 
    type: Boolean, 
    default: false 
  },
  canceledAt: {
    type: Date
  }
}, { timestamps: true });

// Enforce strictly one ACTIVE subscription per user via partial unique index
subscriptionSchema.index(
  { userId: 1, status: 1 }, 
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

const Subscription = mongoose.models.subscriptions || mongoose.model('subscriptions', subscriptionSchema);

module.exports = Subscription;