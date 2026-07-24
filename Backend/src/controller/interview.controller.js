const pdfParse = require('pdf-parse')
const mongoose = require('mongoose')
const { generateInterviewReport, generateResumePfd } = require('../services/ai.service')
const interviewReportModle = require('../models/interviewReport.model')
const interviewReportModel = require('../models/interviewReport.model')

async function generateInterviewReportController(req, res) {
    if (!req.file) {
        return res.status(400).json({
            message: "Resume PDF file is required"
        })
    }

    if (!req.body ?.selfDescription ?.trim() || !req.body ?.jobDescription ?.trim()) {
        return res.status(400).json({
            message: "Job description and self description are required"
        })
    }

    const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText()
    const { selfDescription, jobDescription } = req.body

    const interviewReportByAI = await generateInterviewReport({
        resume: resumeContent.text,
        selfDescription,
        jobDescription
    })

    const interviewReport = await interviewReportModle.create({
        user: req.user.id,
        resume: resumeContent.text,
        selfDescription,
        jobDescription,
        ...interviewReportByAI
    })


    res.status(201).json({
        message: "Interview Report Generated Successfully !",
        interviewReport
    })
}

async function getInterviewReportByIdController(req, res) {
    const { interviewId } = req.params

    if (!mongoose.isValidObjectId(interviewId)) {
        return res.status(400).json({
            message: "Invalid interview report id"
        })
    }

    const interviewReport = await interviewReportModle.findOne({
        _id: interviewId,
        user: req.user.id
    })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found"
        })
    }

    res.status(200).json({
        interviewReport
    })
}


async function getAllInterviewReportController(req, res) {
    const interviewReports = await interviewReportModle
        .find({ user: req.user.id })
        .sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -tecnicalQuestion -behaviooralQuestion -skillGaps -preparationPlan")

    res.status(200).json({
        totalInterviews: interviewReports.length,
        interviewReports
    })
}



/**
 * @description it will require resume jobdescription selfDescription
 */

async function generateResumePdfController(req, res) {
    try {
        const { interviewReportId } = req.params

        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({
                message: "Invalid interview report id"
            })
        }

        const interviewReport = await interviewReportModle.findOne({
            _id: interviewReportId,
            user: req.user.id
        })

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found"
            })
        }

        const { resume, selfDescription, jobDescription } = interviewReport

        const pdfBuffer = await generateResumePfd({ resume, selfDescription, jobDescription })

        if (!pdfBuffer || pdfBuffer.length === 0) {
            return res.status(500).json({ message: 'Failed to generate resume PDF.' })
        }

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename=resume_${interviewReportId}.pdf`
        })

        res.send(pdfBuffer)
    } catch (error) {
        console.error("generateResumePdfController error:", error)
        return res.status(500).json({
            message: error ?.message || "Failed to generate resume PDF."
        })
    }
}

/**
 * It will require only interview report and authanticated user.
 */
async function deleteReportById(req, res) {
    try {
        const { interviewReportId } = req.params;

        //Checking Report ID is vailid or not.
        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({
                message: "Invalid interview report id"
            })
        }

        // 2. Find and delete the report owned by the authenticated user

        const deleteReport = await interviewReportModle.findOneAndDelete({
            _id: interviewReportId, 
            user: req.user.id
        })

        if (!deleteReport) {
            return res.status(404).json({
                message: "Report not Found!",
            })
        }

        return res.status(200).json({
            message: "Report deleted successfully!",
            deletedReportId: interviewReportId
        });

    } catch (err) {
        console.error("deleteReportById error: ", err)
        return res.status(500).json({
            message: err?.message || "Failed to delete the interview report."
        });
    }
}

module.exports = {
    generateInterviewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportController,
    generateResumePdfController,
    deleteReportById
}