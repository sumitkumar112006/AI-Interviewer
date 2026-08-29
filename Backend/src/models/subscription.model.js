const mongoose = require('mongoose');

// MongoDB equivalent of your SQL concept
const subscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, unique: true, index: true },
    plan: { type: String, enum: ['free', 'pro', 'premium'], required: true },
    status: { type: String, enum: ['active', 'canceled', 'expired', 'past_due'], default: 'active' },
    startedAt: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true, index: true },  // ← THIS is the key field
    cancelAtPeriodEnd: { type: Boolean, default: false }
}, { timestamps: true });

const subscriptionModel = mongoose.model('subscriptions', subscriptionSchema);

module.exports = subscriptionModel;