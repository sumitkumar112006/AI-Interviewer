const pdfParse = require('pdf-parse')
const mongoose = require('mongoose')
const {generateInterviewReport} = require('../services/ai.service')
const interviewReportModle = require('../models/interviewReport.model')

async function generateInterviewReportController(req, res) {
    console.log('generateInterviewReport:');

    const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText()
    const { selfDescription, jobDescription } = req.body

    console.log('generateInterviewReport:2');
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
module.exports = {
    generateInterviewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportController
}
