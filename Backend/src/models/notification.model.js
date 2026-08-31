const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        default: null
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: [
            'FEATURE_UPDATE', 
            'CREDIT_UPDATE', 
            'ACCOUNT_STATUS', 
            'SYSTEM',
            'PAYMENT_SUCCESS',
            'PAYMENT_FAILED',
            'SUBSCRIPTION_ACTIVATED',
            'SUBSCRIPTION_CANCELLED'
        ],
        default: 'SYSTEM'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    read: {
        type: Boolean,
        default: false,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const notificationModel = mongoose.models.notifications || mongoose.model('notifications', notificationSchema);

module.exports = notificationModel;
