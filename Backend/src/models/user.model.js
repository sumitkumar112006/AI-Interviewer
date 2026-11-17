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
        enum: [
            'user', 
            'admin', 
            'super_admin', 
            'user_admin', 
            'billing_admin', 
            'support_admin', 
            'ops_admin', 
            'analytics_admin'
        ],
        default: 'user'
    },
    customPermissions: {
        type: [String],
        default: []
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        default: null,
        index: true
    },
    organizationRole: {
        type: String,
        enum: ['member', 'admin', null],
        default: null
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    lastActiveAt: {
        type: Date,
        default: null,
        index: true
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: {
        type: Date,
        default: null
    },
    anonymizedAt: {
        type: Date,
        default: null
    },
    deletionReason: {
        type: String,
        default: null
    },
    deletedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        default: null
    },
    customBonusCredits: {
        type: Number,
        default: 0
    },
    customAiBonusCredits: {
        type: Number,
        default: 0
    },
    generationsUsed: {
        type: Number,
        default: 0
    },
    generationsResetAt: {
        type: Date    // synced with subscription.currentPeriodEnd
    },
    blockedFeatures: {
        aiAssistant: { type: Boolean, default: false },
        resumeGeneration: { type: Boolean, default: false },
        coverLetterGeneration: { type: Boolean, default: false },
        interviewReports: { type: Boolean, default: false }
    },
    careerProfile: {
        selfDescription: {
            type: String,
            default: "",
            trim: true
        },
        targetRole: {
            type: String,
            default: "Full Stack Developer",
            trim: true
        },
        targetCompanies: {
            type: [String],
            default: ["Product Companies"]
        },
        experienceLevel: {
            type: String,
            enum: ["fresher", "mid", "senior"],
            default: "fresher"
        },
        savedDescriptions: [{
            title: { type: String, required: true, trim: true },
            content: { type: String, required: true, trim: true },
            isDefault: { type: Boolean, default: false }
        }],
        savedRoadmaps: [{
            title: { type: String, required: true },
            url: { type: String, required: true },
            topic: { type: String, default: "General" },
            savedAt: { type: Date, default: Date.now }
        }]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

userSchema.index({ isDeleted: 1, lastActiveAt: -1 });
userSchema.index({ lastActiveAt: -1, createdAt: -1 });
userSchema.index({ isDeleted: 1, plan: 1 });
userSchema.index({ isDeleted: 1, createdAt: -1 });

const userModel = mongoose.model("users", userSchema);

module.exports = userModel;
