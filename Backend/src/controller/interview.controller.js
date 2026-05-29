const pdfParse = require('pdf-parse')
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

module.exports = { generateInterviewReportController }