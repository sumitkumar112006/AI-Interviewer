const pdfParse = require('pdf-parse');
const mongoose = require('mongoose');
const { generateCoverLetter, generatePfdFromHtml } = require('../services/ai.service');
const coverLetterModel = require('../models/coverLetter.model');
const interviewReportModel = require('../models/interviewReport.model');

async function createCoverLetterController(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Resume PDF file is required" });
        }

        if (!req.body.jobDescription?.trim()) {
            return res.status(400).json({ message: "Job description is required" });
        }

        const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText();
        const { jobDescription, selfDescription, companyName, roleName } = req.body;

        const coverLetterHtml = await generateCoverLetter({
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            companyName,
            roleName
        });

        const coverLetter = await coverLetterModel.create({
            user: req.user.id,
            resume: resumeContent.text,
            jobDescription,
            selfDescription,
            companyName,
            roleName,
            generatedContent: coverLetterHtml
        });

        res.status(201).json({
            message: "Cover Letter created successfully!",
            coverLetter,
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

        const pdfBuffer = await generatePfdFromHtml(coverLetter.generatedContent);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename=cover_letter_${coverLetterId}.pdf`
        });

        res.send(pdfBuffer);
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

        const { resume, selfDescription, jobDescription } = interviewReport;

        const coverLetterHtml = await generateCoverLetter({
            resume,
            selfDescription,
            jobDescription,
            companyName,
            roleName
        });

        const coverLetter = await coverLetterModel.findOneAndUpdate(
            { interviewReport: interviewReportId, user: req.user.id },
            {
                user: req.user.id,
                interviewReport: interviewReportId,
                resume,
                jobDescription,
                selfDescription,
                companyName,
                roleName,
                generatedContent: coverLetterHtml
            },
            { upsert: true, returnDocument: 'after' }
        );

        res.status(201).json({
            message: "Cover Letter created successfully!",
            coverLetter,
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
