const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * UsageTracking Schema — tracks user resource consumption within the billing period
 */
const usageTrackingSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'users', 
    required: true, 
    index: true 
  },
  subscriptionId: { 
    type: Schema.Types.ObjectId, 
    ref: 'subscriptions' 
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'premium'],
    required: true
  },
  periodStart: { 
    type: Date, 
    required: true 
  },
  periodEnd: { 
    type: Date, 
    required: true 
  },
  interviewsUsed: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  interviewsLimit: { 
    type: Number, 
    required: true,
    default: 3 
  },
  aiCreditsUsed: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  aiCreditsLimit: { 
    type: Number, 
    required: true,
    default: 20 
  }
}, { timestamps: true });

usageTrackingSchema.index({ userId: 1, periodStart: -1 });

const UsageTracking = mongoose.models.UsageTracking || mongoose.model('UsageTracking', usageTrackingSchema);

module.exports = UsageTracking;
