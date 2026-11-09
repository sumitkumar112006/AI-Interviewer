/**
 * appSettings.model.js — Centralized Global Platform Configuration Model
 *
 * Implements:
 * 1. Singleton schema for global application settings.
 * 2. Platform kill-switches (maintenance mode, registration, feature gates).
 * 3. AI provider preferences and baseline tier generation limits.
 * 4. Audit attribution fields tracking who made the last configuration update.
 */

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const appSettingsSchema = new Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        default: 'global_settings',
        index: true
    },
    maintenanceMode: {
        enabled: {
            type: Boolean,
            default: false
        },
        message: {
            type: String,
            default: 'KIVI AI is currently undergoing scheduled platform maintenance. Please check back shortly.',
            trim: true,
            maxlength: 500
        },
        allowedIps: {
            type: [String],
            default: []
        }
    },
    newRegistrationEnabled: {
        type: Boolean,
        default: true
    },
    versionControl: {
        currentVersion: {
            type: String,
            default: '1.0.0',
            trim: true
        },
        minimumSupportedVersion: {
            type: String,
            default: '1.0.0',
            trim: true
        },
        latestRecommendedVersion: {
            type: String,
            default: '1.0.0',
            trim: true
        },
        mandatoryUpdate: {
            type: Boolean,
            default: false
        },
        updateAnnouncement: {
            title: {
                type: String,
                default: '',
                trim: true,
                maxlength: 150
            },
            message: {
                type: String,
                default: '',
                trim: true,
                maxlength: 500
            }
        },
        updateUrl: {
            type: String,
            default: '',
            trim: true
        }
    },
    previousVersionControl: {
        type: Schema.Types.Mixed,
        default: null
    },
    features: {
        resumeGeneration: {
            type: Boolean,
            default: true
        },
        interviewReports: {
            type: Boolean,
            default: true
        },
        aiAssistant: {
            type: Boolean,
            default: true
        },
        coverLetterGeneration: {
            type: Boolean,
            default: true
        }
    },
    ai: {
        defaultProvider: {
            type: String,
            enum: ['auto', 'groq', 'gemini', 'openrouter'],
            default: 'auto'
        },
        allowedProviders: {
            type: [String],
            default: ['auto', 'groq', 'gemini', 'openrouter']
        }
    },
    generationLimits: {
        freeTierMonthlyQuota: {
            type: Number,
            default: 2,
            min: 0,
            max: 100
        },
        freeTierDailyAssistantLimit: {
            type: Number,
            default: 50,
            min: 0,
            max: 1000
        }
    },
    lastUpdatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        default: null
    },
    lastUpdatedByUsername: {
        type: String,
        default: 'system'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AppSettings', appSettingsSchema);

