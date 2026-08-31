const mongoose = require('mongoose');
const { Schema } = mongoose;

const subscriptionPlanSchema = new Schema({
  name: { type: String, required: true }, // 'Free', 'Pro', 'Premium'
  planKey: { type: String, required: true, unique: true, enum: ['free', 'pro', 'premium'] },
  rank: { type: Number, required: true, default: 0 }, // 0 for Free, 1 for Pro, 2 for Premium
  price: { type: Number, required: true, min: 0 }, // default monthly in minor currency units (paise)
  priceMonthly: { type: Number, required: true, min: 0, default: 0 },
  priceYearly: { type: Number, required: true, min: 0, default: 0 },
  currency: { type: String, required: true, default: 'INR' },
  billingCycle: { type: String, enum: ['MONTHLY', 'YEARLY'], default: 'MONTHLY' },
  generationLimit: { type: Number, required: true, default: 3 },
  aiCreditsLimit: { type: Number, required: true, default: 20 },
  features: [{ type: String }],
  isActive: { type: Boolean, default: true },
  isPopular: { type: Boolean, default: false }
}, { timestamps: true });

const SubscriptionPlan = mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan;
