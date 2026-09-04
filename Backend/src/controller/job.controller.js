const mongoose = require('mongoose');
const JobModel = require('../models/job.model');

/**
 * Get job details & status by jobId
 * GET /api/jobs/:jobId
 */
async function getJobStatusController(req, res, next) {
    try {
        const { jobId } = req.params;

        if (!mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({ message: "Invalid jobId" });
        }

        const job = await JobModel.findOne({
            _id: jobId,
            userId: req.user.id
        });

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        res.status(200).json({
            jobId: job._id,
            type: job.type,
            status: job.status,
            progress: job.progress,
            resourceId: job.resourceId,
            resourceModel: job.resourceModel,
            result: job.result,
            error: job.error,
            creditDeducted: job.creditDeducted,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Find active pending/processing job for current user (optionally filtered by type and resourceId)
 * GET /api/jobs/active?type=...&resourceId=...
 */
async function getActiveJobController(req, res, next) {
    try {
        const { type, resourceId } = req.query;

        const query = {
            userId: req.user.id,
            status: { $in: ['pending', 'processing'] }
        };

        if (type) {
            query.type = type;
        }

        if (resourceId) {
            query.resourceId = mongoose.isValidObjectId(resourceId)
                ? new mongoose.Types.ObjectId(resourceId)
                : resourceId;
        }

        const activeJob = await JobModel.findOne(query).sort({ createdAt: -1 });

        if (!activeJob) {
            return res.status(200).json({ activeJob: null });
        }

        res.status(200).json({
            activeJob: {
                jobId: activeJob._id,
                type: activeJob.type,
                status: activeJob.status,
                resourceId: activeJob.resourceId,
                resourceModel: activeJob.resourceModel,
                createdAt: activeJob.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getJobStatusController,
    getActiveJobController
};
