const pdfParse = require('pdf-parse')
const mongoose = require('mongoose')
const crypto = require('crypto')
const { generateInterviewReport, generateResumePfd, generateResumeHtml, rewriteResumeSection, getAIStatus } = require('../services/ai.service')
const interviewReportModle = require('../models/interviewReport.model')
const interviewReportModel = require('../models/interviewReport.model')
const { getCache, setCache, deleteCache } = require('../services/redis.service')
const { processReportSkills, aggregateSkillAnalytics } = require('../services/skills.service')

async function generateInterviewReportController(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "Resume PDF file is required"
            })
        }

        if (!req.body?.selfDescription?.trim() || !req.body?.jobDescription?.trim()) {
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

        const detectedSkills = processReportSkills({
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            ...interviewReportByAI
        })

        const interviewReport = await interviewReportModle.create({
            user: req.user.id,
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            detectedSkills,
            ...interviewReportByAI
        })

        // Invalidate user reports cache
        await deleteCache(`cache:reports:user:${req.user.id}`)

        res.status(201).json({
            message: "Interview Report Generated Successfully !",
            interviewReport
        })
    } catch (error) {
        next(error)
    }
}

async function getInterviewReportByIdController(req, res, next) {
    try {
        const { interviewId } = req.params

        if (!mongoose.isValidObjectId(interviewId)) {
            return res.status(400).json({
                message: "Invalid interview report id"
            })
        }

        const cacheKey = `cache:report:${interviewId}:${req.user.id}`
        const cachedReport = await getCache(cacheKey)

        if (cachedReport) {
            return res.status(200).json({
                interviewReport: cachedReport
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

        await setCache(cacheKey, interviewReport, 3600)

        res.status(200).json({
            interviewReport
        })
    } catch (error) {
        next(error)
    }
}

async function getAllInterviewReportController(req, res, next) {
    try {
        const cacheKey = `cache:reports:user:${req.user.id}`
        const cachedSummary = await getCache(cacheKey)

        if (cachedSummary) {
            return res.status(200).json(cachedSummary)
        }

        const interviewReports = await interviewReportModle
            .find({ user: req.user.id })
            .sort({ createdAt: -1 })

        const reportsWithHash = interviewReports.map(report => {
            const reportObj = report.toObject()
            const hash = crypto.createHash('md5').update(reportObj.resume || '').digest('hex')

            // If report doesn't have detectedSkills yet, process dynamically
            if (!reportObj.detectedSkills || reportObj.detectedSkills.length === 0) {
                reportObj.detectedSkills = processReportSkills(reportObj)
            }

            delete reportObj.resume
            delete reportObj.selfDescription
            delete reportObj.jobDescription
            delete reportObj.technicalQuestions
            delete reportObj.behavioralQuestion
            delete reportObj.preparationPlan
            delete reportObj.__v

            reportObj.resumeHash = hash
            return reportObj
        })

        const uniqueResumes = new Set(reportsWithHash.map(r => r.resumeHash))

        const skillAnalytics = aggregateSkillAnalytics(interviewReports)

        const responseData = {
            totalInterviews: reportsWithHash.length,
            totalResumes: uniqueResumes.size,
            skillAnalytics,
            interviewReports: reportsWithHash
        }

        await setCache(cacheKey, responseData, 600)

        res.status(200).json(responseData)
    } catch (error) {
        next(error)
    }
}

async function getSkillAnalyticsController(req, res, next) {
    try {
        const interviewReports = await interviewReportModle
            .find({ user: req.user.id })
            .sort({ createdAt: -1 })

        const skillAnalytics = aggregateSkillAnalytics(interviewReports)

        res.status(200).json({
            message: "Skill analytics retrieved successfully",
            skillAnalytics
        })
    } catch (error) {
        next(error)
    }
}

async function generateResumePdfController(req, res, next) {
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

        // If HTML already exists, return the report as-is
        if (interviewReport.generatedResumeHtml) {
            return res.status(200).json({ interviewReport })
        }

        // Generate resume HTML from AI and persist it
        const { resume, selfDescription, jobDescription } = interviewReport
        const generatedHtml = await generateResumeHtml({ resume, selfDescription, jobDescription })
        interviewReport.generatedResumeHtml = generatedHtml
        await interviewReport.save()

        // Invalidate report detail cache
        const cacheKey = `cache:report:${interviewReportId}:${req.user.id}`
        await deleteCache(cacheKey)

        res.status(200).json({ interviewReport })
    } catch (error) {
        console.error("generateResumePdfController error:", error)
        next(error)
    }
}

async function deleteReportById(req, res, next) {
    try {
        const { interviewReportId } = req.params;

        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({
                message: "Invalid interview report id"
            })
        }

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
        next(err)
    }
}

async function updateResumeHtmlController(req, res, next) {
    try {
        const { interviewReportId } = req.params;
        const { generatedResumeHtml } = req.body;

        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({ message: "Invalid report id" });
        }

        const report = await interviewReportModel.findOneAndUpdate(
            { _id: interviewReportId, user: req.user.id },
            { generatedResumeHtml },
            { returnDocument: 'after' }
        );

        if (!report) {
            return res.status(404).json({ message: "Interview report not found" });
        }

        // Invalidate report detail cache
        const cacheKey = `cache:report:${interviewReportId}:${req.user.id}`
        await deleteCache(cacheKey)

        res.status(200).json({
            message: "Resume updated successfully!",
            interviewReport: report
        });
    } catch (error) {
        next(error)
    }
}

async function updateInterviewProgressController(req, res, next) {
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
            { returnDocument: 'after' }
        );

        if (!report) {
            return res.status(404).json({ message: "Interview report not found" });
        }

        // Invalidate report detail cache
        const cacheKey = `cache:report:${interviewId}:${req.user.id}`
        await deleteCache(cacheKey)

        res.status(200).json({
            message: "Interview progress updated successfully!",
            interviewReport: report
        });
    } catch (error) {
        next(error)
    }
}

async function rewriteResumeSectionController(req, res, next) {
    try {
        const { selectedText, instruction, action, message } = req.body;

        const aiResponse = await rewriteResumeSection({ selectedText, instruction, action, message });

        res.status(200).json({
            message: "Success",
            replyText: aiResponse.replyText,
            suggestedSnippet: aiResponse.suggestedSnippet,
            rewrittenText: aiResponse.suggestedSnippet
        });
    } catch (error) {
        next(error);
    }
}

async function getAiModelInfoController(req, res, next) {
    try {
        res.status(200).json(getAIStatus());
    } catch (error) {
        next(error);
    }
}

module.exports = {
    generateInterviewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportController,
    getSkillAnalyticsController,
    generateResumePdfController,
    deleteReportById,
    updateResumeHtmlController,
    updateInterviewProgressController,
    rewriteResumeSectionController,
    getAiModelInfoController
}