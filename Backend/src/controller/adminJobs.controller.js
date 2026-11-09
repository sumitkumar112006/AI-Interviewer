/**
 * adminJobs.controller.js — Background Job Monitoring & Management Controller
 *
 * Implements:
 * 1. Bounded, paginated queries for background jobs with indexed search & status filters.
 * 2. Summary metrics & BullMQ queue state overview (without expensive scans).
 * 3. Safe retry handler with deduplication protection (never creates duplicate records).
 * 4. Safe cancellation handler for pending/processing jobs.
 * 5. Sanitized inspection drawer details (protects sensitive payloads and credentials).
 * 6. Admin Audit Trail integration for all privileged job operations.
 */

'use strict';

const mongoose = require('mongoose');
const JobModel = require('../models/job.model');
const userModel = require('../models/user.model');
const { aiQueue, enqueueAiJob } = require('../jobs/aiQueue');
const auditLogService = require('../services/auditLog.service');

/**
 * Deep recursive payload sanitizer to redact sensitive API keys, tokens, and credentials
 */
function sanitizePayload(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizePayload);

    const SENSITIVE_PATTERNS = /password|token|jwt|apikey|secret|credential|auth/i;
    const sanitized = {};
    for (const [key, val] of Object.entries(obj)) {
        if (SENSITIVE_PATTERNS.test(key)) {
            sanitized[key] = '[REDACTED]';
        } else if (val && typeof val === 'object') {
            sanitized[key] = sanitizePayload(val);
        } else {
            sanitized[key] = val;
        }
    }
    return sanitized;
}

/**
 * @name getAdminJobsController
 * @route GET /api/admin/jobs
 * @access Private (Admin Only)
 */
async function getAdminJobsController(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const { status, type, search, startDate, endDate } = req.query;

        const filter = {};

        // 1. Status Filter
        if (status && ['pending', 'processing', 'done', 'failed', 'cancelled'].includes(status.toLowerCase())) {
            filter.status = status.toLowerCase();
        }

        // 2. Type Filter
        if (type && ['interview_report', 'resume_html', 'cover_letter', 'cover_letter_report', 'rewrite_section'].includes(type.toLowerCase())) {
            filter.type = type.toLowerCase();
        }

        // 3. Date Range Filter (createdAt)
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate && !isNaN(new Date(startDate).getTime())) filter.createdAt.$gte = new Date(startDate);
            if (endDate && !isNaN(new Date(endDate).getTime())) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = e;
            }
        }

        // 4. Search Filter
        if (search && search.trim()) {
            const cleanSearch = search.trim();

            if (mongoose.Types.ObjectId.isValid(cleanSearch)) {
                filter.$or = [
                    { _id: new mongoose.Types.ObjectId(cleanSearch) },
                    { userId: new mongoose.Types.ObjectId(cleanSearch) },
                    { resourceId: new mongoose.Types.ObjectId(cleanSearch) }
                ];
            } else {
                const searchRegex = new RegExp(cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                const matchingUsers = await userModel.find({
                    $or: [{ username: searchRegex }, { email: searchRegex }]
                }).select('_id').limit(50).lean();

                const userIds = matchingUsers.map(u => u._id);
                filter.$or = [
                    { bullJobId: searchRegex },
                    { error: searchRegex }
                ];

                if (userIds.length > 0) {
                    filter.$or.push({ userId: { $in: userIds } });
                }
            }
        }

        // 5. Bounded Parallel Query (Lightweight projections to protect memory)
        const [jobs, totalCount, summaryAgg, queueMetrics] = await Promise.all([
            JobModel.find(filter)
                .select('_id userId type status progress attempts durationMs startedAt completedAt error bullJobId resourceId resourceModel creditDeducted createdAt updatedAt')
                .populate('userId', 'username email isDeleted')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            JobModel.countDocuments(filter),
            JobModel.aggregate([
                {
                    $group: {
                        _id: null,
                        totalJobs: { $sum: 1 },
                        pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                        processingCount: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
                        doneCount: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
                        failedCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
                        cancelledCount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
                    }
                }
            ]),
            (async () => {
                try {
                    if (aiQueue) {
                        return await aiQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
                    }
                } catch (_) {}
                return { waiting: 0, active: 0, completed: 0, failed: 0 };
            })()
        ]);

        const summaryData = summaryAgg[0] || {
            totalJobs: 0,
            pendingCount: 0,
            processingCount: 0,
            doneCount: 0,
            failedCount: 0,
            cancelledCount: 0
        };

        const totalFinished = (summaryData.doneCount + summaryData.failedCount);
        const successRate = totalFinished > 0 
            ? `${((summaryData.doneCount / totalFinished) * 100).toFixed(1)}%` 
            : '100%';

        const summary = {
            totalJobs: summaryData.totalJobs,
            pendingCount: summaryData.pendingCount,
            processingCount: summaryData.processingCount,
            doneCount: summaryData.doneCount,
            failedCount: summaryData.failedCount,
            cancelledCount: summaryData.cancelledCount,
            successRate,
            queueMetrics: queueMetrics || { waiting: 0, active: 0, completed: 0, failed: 0 }
        };

        return res.status(200).json({
            success: true,
            data: jobs,
            summary,
            pagination: {
                total: totalCount,
                page,
                pages: Math.ceil(totalCount / limit) || 1,
                limit
            }
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Failed to retrieve background jobs.' });
    }
}

/**
 * @name getAdminJobDetailsController
 * @route GET /api/admin/jobs/:jobId
 * @access Private (Admin Only)
 */
async function getAdminJobDetailsController(req, res) {
    try {
        const { jobId } = req.params;

        if (!mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({ message: 'Invalid Job ID format.' });
        }

        const job = await JobModel.findById(jobId)
            .populate('userId', 'username email isDeleted plan role')
            .lean();

        if (!job) {
            return res.status(404).json({ message: 'Background job record not found.' });
        }

        // Live BullMQ Queue Inspect
        let bullDetails = null;
        try {
            if (aiQueue) {
                const bullJob = await aiQueue.getJob(jobId);
                if (bullJob) {
                    bullDetails = {
                        id: bullJob.id,
                        name: bullJob.name,
                        attemptsMade: bullJob.attemptsMade,
                        timestamp: bullJob.timestamp,
                        processedOn: bullJob.processedOn,
                        finishedOn: bullJob.finishedOn,
                        failedReason: bullJob.failedReason
                    };
                }
            }
        } catch (_) {}

        // Deep sanitize input to protect sensitive passwords or credentials
        const sanitizedInput = sanitizePayload(job.input || {});

        const detailedJob = {
            ...job,
            input: sanitizedInput,
            bullJob: bullDetails
        };

        return res.status(200).json({
            success: true,
            job: detailedJob,
            data: detailedJob
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Failed to inspect job details.' });
    }
}

/**
 * @name retryAdminJobController
 * @route POST /api/admin/jobs/:jobId/retry
 * @access Private (Admin Only)
 */
async function retryAdminJobController(req, res) {
    try {
        const { jobId } = req.params;
        const { reason } = req.body || {};

        if (!mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({ message: 'Invalid Job ID.' });
        }

        const job = await JobModel.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'Background job not found.' });
        }

        // Critical Safety Rule 1: Never retry an already succeeded job to prevent duplicate records
        if (job.status === 'done') {
            return res.status(400).json({
                message: 'Job has already succeeded. Retrying completed jobs is blocked to prevent duplicate record generation.'
            });
        }

        // Critical Safety Rule 2: Never retry a job that is actively processing
        if (job.status === 'processing') {
            return res.status(400).json({
                message: 'Job is currently actively processing. Please wait for it to complete or fail.'
            });
        }

        // Check BullMQ state and re-queue cleanly
        try {
            if (aiQueue) {
                const existingBullJob = await aiQueue.getJob(jobId);
                if (existingBullJob) {
                    if (await existingBullJob.isFailed()) {
                        await existingBullJob.retry();
                    } else {
                        await existingBullJob.remove().catch(() => {});
                        await enqueueAiJob(job.type, { ...job.input, jobId: job._id });
                    }
                } else {
                    await enqueueAiJob(job.type, { ...job.input, jobId: job._id });
                }
            }
        } catch (queueErr) {
            console.warn('[retryAdminJobController] BullMQ notice:', queueErr.message);
            // Fallback: direct enqueue
            await enqueueAiJob(job.type, { ...job.input, jobId: job._id });
        }

        // Reset Job status and increment attempts
        job.status = 'pending';
        job.progress = 0;
        job.error = null;
        job.attempts = (job.attempts || 1) + 1;
        job.startedAt = null;
        job.completedAt = null;
        await job.save();

        // Audit Trail Event
        await auditLogService.recordAdminAudit({
            req,
            action: 'JOB_RETRIED',
            category: 'ADMIN',
            severity: 'WARN',
            targetId: job._id,
            targetType: 'Job',
            targetIdentifier: `${job.type} (${job._id})`,
            changeSummary: `Administrator "${req.user.username}" retried failed job "${job._id}" (Type: ${job.type}).`,
            reason: reason || 'Manual administrative retry'
        });

        return res.status(200).json({
            success: true,
            message: `Background job "${job._id}" successfully re-queued for processing.`,
            job
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Failed to retry background job.' });
    }
}

/**
 * @name cancelAdminJobController
 * @route POST /api/admin/jobs/:jobId/cancel
 * @access Private (Admin Only)
 */
async function cancelAdminJobController(req, res) {
    try {
        const { jobId } = req.params;
        const { reason } = req.body || {};

        if (!mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({ message: 'Invalid Job ID.' });
        }

        const job = await JobModel.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'Background job not found.' });
        }

        if (job.status === 'done') {
            return res.status(400).json({ message: 'Cannot cancel an already completed job.' });
        }

        if (job.status === 'cancelled') {
            return res.status(200).json({ success: true, message: 'Job is already cancelled.', job });
        }

        // Try removing from BullMQ queue
        try {
            if (aiQueue) {
                const bullJob = await aiQueue.getJob(jobId);
                if (bullJob) {
                    await bullJob.remove().catch(() => {});
                }
            }
        } catch (_) {}

        job.status = 'cancelled';
        job.error = reason ? `Cancelled by administrator: ${reason}` : 'Cancelled by administrator.';
        job.completedAt = new Date();
        if (job.startedAt) {
            job.durationMs = Date.now() - new Date(job.startedAt).getTime();
        }
        await job.save();

        // Audit Trail Event
        await auditLogService.recordAdminAudit({
            req,
            action: 'JOB_CANCELLED',
            category: 'ADMIN',
            severity: 'WARN',
            targetId: job._id,
            targetType: 'Job',
            targetIdentifier: `${job.type} (${job._id})`,
            changeSummary: `Administrator "${req.user.username}" cancelled job "${job._id}" (Type: ${job.type}).`,
            reason: reason || 'Administrative cancellation'
        });

        return res.status(200).json({
            success: true,
            message: `Background job "${job._id}" cancelled successfully.`,
            job
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Failed to cancel background job.' });
    }
}

module.exports = {
    getAdminJobsController,
    getAdminJobDetailsController,
    retryAdminJobController,
    cancelAdminJobController
};

