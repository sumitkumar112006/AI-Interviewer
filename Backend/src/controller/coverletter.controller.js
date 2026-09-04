const pdfParse = require('pdf-parse');
const mongoose = require('mongoose');
const { generateCoverLetter } = require('../services/ai.service');
const coverLetterModel = require('../models/coverLetter.model');
const interviewReportModel = require('../models/interviewReport.model');
const JobModel = require('../models/job.model');
const { enqueueAiJob } = require('../jobs/aiQueue');

async function createCoverLetterController(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Resume PDF file is required" });
        }

        if (!req.body.jobDescription?.trim()) {
            return res.status(400).json({ message: "Job description is required" });
        }

        // 1. Check for active pending/processing job
        const existingJob = await JobModel.findOne({
            userId: req.user.id,
            type: 'cover_letter',
            status: { $in: ['pending', 'processing'] }
        });

        if (existingJob) {
            return res.status(409).json({
                message: "Cover letter generation is already running.",
                jobId: existingJob._id,
                status: existingJob.status,
                genCredits: req.genCredits
            });
        }

        // 2. Parse PDF buffer in milliseconds
        const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText();
        const { jobDescription, selfDescription, companyName, roleName } = req.body;

        // 3. Create Job document in MongoDB
        const job = await JobModel.create({
            userId: req.user.id,
            type: 'cover_letter',
            resourceId: null,
            resourceModel: 'CoverLetter',
            status: 'pending',
            input: {
                resumeText: resumeContent.text,
                selfDescription,
                jobDescription,
                companyName,
                roleName
            }
        });

        // 4. Enqueue to BullMQ
        await enqueueAiJob('cover_letter', { jobId: job._id });

        // 5. Respond 202
        return res.status(202).json({
            message: "Cover Letter generation started.",
            jobId: job._id,
            status: 'pending',
            genCredits: req.genCredits
        });
    } catch (error) {
        console.error("createCoverLetterController error:", error);
        next(error);
    }
}

async function getCoverLetterByIdController(req, res, next) {
    try {
        const { coverLetterId } = req.params;

        if (!mongoose.isValidObjectId(coverLetterId)) {
            return res.status(400).json({ message: "Invalid cover letter id" });
        }

        const coverLetter = await coverLetterModel.findOne({
            _id: coverLetterId,
            user: req.user.id
        });

        if (!coverLetter) {
            return res.status(404).json({ message: "Cover Letter not found" });
        }

        res.status(200).json({ coverLetter });
    } catch (error) {
        next(error);
    }
}

async function getAllCoverLettersController(req, res, next) {
    try {
        const coverLetters = await coverLetterModel
            .find({ user: req.user.id })
            .select('-resume -jobDescription -selfDescription') // Exclude large fields in list
            .sort({ createdAt: -1 });

        res.status(200).json({ coverLetters });
    } catch (error) {
        next(error);
    }
}

async function generateCoverLetterPdfController(req, res, next) {
    try {
        const { coverLetterId } = req.params;

        if (!mongoose.isValidObjectId(coverLetterId)) {
            return res.status(400).json({ message: "Invalid cover letter id" });
        }

        const coverLetter = await coverLetterModel.findOne({
            _id: coverLetterId,
            user: req.user.id
        });

        if (!coverLetter) {
            return res.status(404).json({ message: "Cover Letter not found" });
        }

        res.status(200).json({
            message: "Cover letter retrieved successfully",
            coverLetter
        });
    } catch (error) {
        next(error);
    }
}

async function deleteCoverLetterController(req, res, next) {
    try {
        const { coverLetterId } = req.params;

        if (!mongoose.isValidObjectId(coverLetterId)) {
            return res.status(400).json({ message: "Invalid cover letter id" });
        }

        const deleted = await coverLetterModel.findOneAndDelete({
            _id: coverLetterId,
            user: req.user.id
        });

        if (!deleted) {
            return res.status(404).json({ message: "Cover letter not found" });
        }

        res.status(200).json({ message: "Cover letter deleted successfully!" });
    } catch (error) {
        next(error);
    }
}

async function createCoverLetterFromReportController(req, res, next) {
    try {
        const { interviewReportId } = req.params;
        const { companyName, roleName } = req.body;

        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({ message: "Invalid interview report id" });
        }

        const interviewReport = await interviewReportModel.findOne({
            _id: interviewReportId,
            user: req.user.id
        });

        if (!interviewReport) {
            return res.status(404).json({ message: "Interview report not found" });
        }

        // 1. Check for active pending/processing job for this report
        const existingJob = await JobModel.findOne({
            userId: req.user.id,
            type: 'cover_letter_report',
            resourceId: interviewReportId,
            status: { $in: ['pending', 'processing'] }
        });

        if (existingJob) {
            return res.status(409).json({
                message: "Cover letter generation is already running for this report.",
                jobId: existingJob._id,
                status: existingJob.status,
                genCredits: req.genCredits
            });
        }

        // 2. Create Job document in MongoDB
        const job = await JobModel.create({
            userId: req.user.id,
            type: 'cover_letter_report',
            resourceId: interviewReportId,
            resourceModel: 'CoverLetter',
            status: 'pending',
            input: {
                interviewReportId,
                companyName,
                roleName
            }
        });

        // 3. Enqueue to BullMQ
        await enqueueAiJob('cover_letter_report', { jobId: job._id });

        // 4. Respond 202
        return res.status(202).json({
            message: "Cover letter generation started.",
            jobId: job._id,
            status: 'pending',
            genCredits: req.genCredits
        });
    } catch (error) {
        console.error("createCoverLetterFromReportController error:", error);
        next(error);
    }
}

async function getCoverLetterByReportIdController(req, res, next) {
    try {
        const { interviewReportId } = req.params;

        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({ message: "Invalid interview report id" });
        }

        const coverLetter = await coverLetterModel.findOne({
            interviewReport: interviewReportId,
            user: req.user.id
        });

        res.status(200).json({ coverLetter });
    } catch (error) {
        next(error);
    }
}

async function updateCoverLetterController(req, res, next) {
    try {
        const { coverLetterId } = req.params;
        const { generatedContent } = req.body;

        if (!mongoose.isValidObjectId(coverLetterId)) {
            return res.status(400).json({ message: "Invalid cover letter id" });
        }

        const coverLetter = await coverLetterModel.findOneAndUpdate(
            { _id: coverLetterId, user: req.user.id },
            { generatedContent },
            { returnDocument: 'after' }
        );

        if (!coverLetter) {
            return res.status(404).json({ message: "Cover Letter not found" });
        }

        res.status(200).json({
            message: "Cover Letter updated successfully!",
            coverLetter
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createCoverLetterController,
    getCoverLetterByIdController,
    getAllCoverLettersController,
    generateCoverLetterPdfController,
    deleteCoverLetterController,
    createCoverLetterFromReportController,
    getCoverLetterByReportIdController,
    updateCoverLetterController
};
