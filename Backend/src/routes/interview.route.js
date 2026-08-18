const express = require('express')
const authMidleware = require('../middleware/auth.middleware')
const interviewController = require('../controller/interview.controller')
const upload = require('../middleware/file.middleware')
const { createRateLimiter } = require('../middleware/rateLimiter.middleware')

const interviewRouter = express.Router();

const aiGenerationLimiter = createRateLimiter({
    prefix: 'ratelimit:ai',
    windowSeconds: 60, // 1 minute
    maxRequests: 5,
    message: 'AI Report generation limit reached. Please wait a minute before generating another report.'
});

/**
 * @route POST /api/interview
 * @description generate new interview report on the bassis of user self description, resume and job description.
 * @access private
 */

interviewRouter.post('/', authMidleware.authUser, aiGenerationLimiter, upload.single("resume"), interviewController.generateInterviewReportController)

/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interview id.
 * @access private
 */
interviewRouter.get('/report/:interviewId', authMidleware.authUser, interviewController.getInterviewReportByIdController)

/**
 * @route GET /api/interview/skill-analytics
 * @description Get aggregated major skill analytics and performance metrics.
 * @access private
 */
interviewRouter.get('/skill-analytics', authMidleware.authUser, interviewController.getSkillAnalyticsController)

/**
 * @route GET /api/interview/:interviewId
 * @description backward-compatible interview report lookup by interview id.
 * @access private
 */
interviewRouter.get('/:interviewId', authMidleware.authUser, interviewController.getInterviewReportByIdController)

/**
 * @route GET /api/interview 
 * @description get all interview reports of logged in user.
 * @access private
 */

interviewRouter.get("/", authMidleware.authUser, interviewController.getAllInterviewReportController)

/**
 * @description This route is for generating resume pdf from the interview report.
 * @access private
 */

interviewRouter.post('/resume/pdf/:interviewReportId', authMidleware.authUser, interviewController.generateResumePdfController)

/**
 * @description This api will delete the Reports by ReportID.
 * @access private
 */

interviewRouter.delete('/:interviewReportId', authMidleware.authUser, interviewController.deleteReportById)

// Update resume HTML content
interviewRouter.put('/resume/:interviewReportId', authMidleware.authUser, interviewController.updateResumeHtmlController)

// Update interview progress (questions responses, roadmap tasks)
interviewRouter.put('/progress/:interviewId', authMidleware.authUser, interviewController.updateInterviewProgressController)

// Rewrite a selected resume section/bullet point with AI Writer
interviewRouter.post('/resume/rewrite-section', authMidleware.authUser, interviewController.rewriteResumeSectionController)

// Get active AI model status and info
interviewRouter.get('/model-info', authMidleware.authUser, interviewController.getAiModelInfoController)

module.exports = interviewRouter
