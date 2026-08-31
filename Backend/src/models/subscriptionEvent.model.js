const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * SubscriptionEvent Schema — audit trail for all subscription state transitions
 */
const subscriptionEventSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'users', 
    required: true, 
    index: true 
  },
  subscriptionId: { 
    type: Schema.Types.ObjectId, 
    ref: 'subscriptions', 
    required: true, 
    index: true 
  },
  eventType: { 
    type: String, 
    enum: ['ACTIVATED', 'RENEWED', 'UPGRADED', 'DOWNGRADED', 'CANCELLED', 'EXPIRED'], 
    required: true,
    index: true
  },
  fromPlan: {
    type: String,
    enum: ['free', 'pro', 'premium']
  },
  toPlan: {
    type: String,
    enum: ['free', 'pro', 'premium'],
    required: true
  },
  paymentOrderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'PaymentOrder' 
  },
  paymentId: {
    type: Schema.Types.ObjectId,
    ref: 'Payment'
  },
  metadata: { 
    type: Schema.Types.Mixed 
  }
}, { timestamps: true });

subscriptionEventSchema.index({ userId: 1, createdAt: -1 });

const SubscriptionEvent = mongoose.models.SubscriptionEvent || mongoose.model('SubscriptionEvent', subscriptionEventSchema);

module.exports = SubscriptionEvent;
