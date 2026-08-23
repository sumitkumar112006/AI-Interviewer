const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: [true, "Username alresdy taken"],
        required: true,
    },
    email: {
        type: String,
        unique: [true, "Email already taken."],
        required: true,
        
    },
    password: {
        type: String,
        required: true,
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    plan: {
        type: String,
        enum: ['free', 'pro', 'premium'],
        default: 'free'
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'super_admin'],
        default: 'user'
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    customBonusCredits: {
        type: Number,
        default: 0
    },
    blockedFeatures: {
        aiAssistant: { type: Boolean, default: false },
        resumeGeneration: { type: Boolean, default: false },
        coverLetterGeneration: { type: Boolean, default: false },
        interviewReports: { type: Boolean, default: false }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const userModel = mongoose.model("users", userSchema);

module.exports = userModel;
