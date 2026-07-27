const pdfParse = require('pdf-parse')
const mongoose = require('mongoose')
const crypto = require('crypto')
const { generateInterviewReport, generateResumePfd, generateResumeHtml, generatePfdFromHtml } = require('../services/ai.service')
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
        .sort({ createdAt: -1 })

    const reportsWithHash = interviewReports.map(report => {
        const reportObj = report.toObject()
        // Generate a hash of the resume text
        const hash = crypto.createHash('md5').update(reportObj.resume || '').digest('hex')
        
        // Remove large fields
        delete reportObj.resume
        delete reportObj.selfDescription
        delete reportObj.jobDescription
        delete reportObj.technicalQuestions
        delete reportObj.behavioralQuestion
        delete reportObj.skillGaps
        delete reportObj.preparationPlan
        delete reportObj.__v
        
        reportObj.resumeHash = hash
        return reportObj
    })

    const uniqueResumes = new Set(reportsWithHash.map(r => r.resumeHash))

    res.status(200).json({
        totalInterviews: reportsWithHash.length,
        totalResumes: uniqueResumes.size,
        interviewReports: reportsWithHash
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
        const { htmlContent } = req.body

        let pdfBuffer
        if (htmlContent) {
            pdfBuffer = await generatePfdFromHtml(htmlContent)
        } else if (interviewReport.generatedResumeHtml) {
            pdfBuffer = await generatePfdFromHtml(interviewReport.generatedResumeHtml)
        } else {
            const generatedHtml = await generateResumeHtml({ resume, selfDescription, jobDescription })
            interviewReport.generatedResumeHtml = generatedHtml
            await interviewReport.save()
            pdfBuffer = await generatePfdFromHtml(generatedHtml)
        }

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

async function updateResumeHtmlController(req, res) {
    try {
        const { interviewReportId } = req.params;
        const { generatedResumeHtml } = req.body;

        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({ message: "Invalid report id" });
        }

        const report = await interviewReportModel.findOneAndUpdate(
            { _id: interviewReportId, user: req.user.id },
            { generatedResumeHtml },
            { new: true }
        );

        if (!report) {
            return res.status(404).json({ message: "Interview report not found" });
        }

        res.status(200).json({
            message: "Resume updated successfully!",
            interviewReport: report
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function updateInterviewProgressController(req, res) {
    try {
        const { interviewId } = req.params;
        const { technicalQuestions, behavioralQuestion, completedTasks } = req.body;

        if (!mongoose.isValidObjectId(interviewId)) {
            return res.status(400).json({ message: "Invalid report id" });
        }

        const updateData = {};
        if (technicalQuestions !== undefined) updateData.technicalQuestions = technicalQuestions;
        if (behavioralQuestion !== undefined) updateData.behavioralQuestion = behavioralQuestion;
        if (completedTasks !== undefined) updateData.completedTasks = completedTasks;

        const report = await interviewReportModel.findOneAndUpdate(
            { _id: interviewId, user: req.user.id },
            updateData,
            { new: true }
        );

        if (!report) {
            return res.status(404).json({ message: "Interview report not found" });
        }

        res.status(200).json({
            message: "Interview progress updated successfully!",
            interviewReport: report
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    generateInterviewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportController,
    generateResumePdfController,
    deleteReportById,
    updateResumeHtmlController,
    updateInterviewProgressController
}