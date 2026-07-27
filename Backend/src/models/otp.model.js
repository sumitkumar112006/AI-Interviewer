const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    otp: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // Auto-deletes document after 10 minutes (600s)
    }
});

const otpModel = mongoose.model('Otp', otpSchema);

module.exports = otpModel;
