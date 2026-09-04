const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'interview_report',
            'resume_html',
            'cover_letter',
            'cover_letter_report',
            'rewrite_section'
        ],
        index: true
    },
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true
    },
    resourceModel: {
        type: String,
        enum: ['InterviewReport', 'CoverLetter', null],
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'done', 'failed'],
        default: 'pending',
        index: true
    },
    progress: {
        type: Number,
        default: 0
    },
    input: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    result: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    error: {
        type: String,
        default: null
    },
    creditDeducted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Composite index for fast deduplication check: userId + type + resourceId + status
jobSchema.index({ userId: 1, type: 1, resourceId: 1, status: 1 });

const JobModel = mongoose.model('Job', jobSchema);

module.exports = JobModel;
