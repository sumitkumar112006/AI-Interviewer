const express = require('express')
const authMidleware = require('../middleware/auth.middleware')
const interviewController = require('../controller/interview.controller')
const upload = require('../middleware/file.middleware')
const { createRateLimiter, createTieredRateLimiter } = require('../middleware/rateLimiter.middleware')

const interviewRouter = express.Router();

const fullGenerationTieredLimiter = createTieredRateLimiter({
    prefix: 'ratelimit:full-generation',
    windowSeconds: 86400, // 24-hour daily limit
    limits: { free: 3, pro: 30, premium: 150 },
    message: 'Full generation daily limit reached for your plan.'
});

const aiAssistantTieredLimiter = createTieredRateLimiter({
    prefix: 'ratelimit:ai-assistant',
    windowSeconds: 86400, // 24-hour daily limit
    limits: { free: 10, pro: 100, premium: 500 },
    message: 'AI Assistant daily limit reached for your plan.'
});

const generateResumePdfControllerLimiter = createRateLimiter({
    prefix: 'ratelimit:generate-resume-pdf',
    windowSeconds: 60, // 1 minute
    maxRequests: 3,
    message: 'Generate resume PDF limit reached. Please wait a minute before generating another PDF.'
});

const getAllReportLimiter = createRateLimiter({
    prefix: 'ratelimit:get-all-reports',
    windowSeconds: 60, // 1 minute
    maxRequests: 50,
    message: 'Get All Reports limit reached. Please wait a minute before getting another reports.'
});


const checkInterviewReportsAccess = (req, res, next) => {
    if (req.user?.blockedFeatures?.interviewReports) {
        return res.status(403).json({ message: "Mock Interview & Report generation has been disabled for your account by an administrator. ❌" });
    }
    next();
};

const checkAiAssistantAccess = (req, res, next) => {
    if (req.user?.blockedFeatures?.aiAssistant) {
        return res.status(403).json({ message: "AI Assistant access has been disabled for your account by an administrator. ❌" });
    }
    next();
};

/**
 * @route POST /api/interview
 * @description generate new interview report on the bassis of user self description, resume and job description.
 * @access private
 */

interviewRouter.post('/', authMidleware.authUser, checkInterviewReportsAccess, fullGenerationTieredLimiter, upload.single("resume"), interviewController.generateInterviewReportController)

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

interviewRouter.get("/", authMidleware.authUser, getAllReportLimiter, interviewController.getAllInterviewReportController)

/**
 * @description This route is for generating resume pdf from the interview report.
 * @access private
 */

interviewRouter.post('/resume/pdf/:interviewReportId', authMidleware.authUser, generateResumePdfControllerLimiter, interviewController.generateResumePdfController)

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
interviewRouter.post('/resume/rewrite-section', authMidleware.authUser, checkAiAssistantAccess, aiAssistantTieredLimiter, interviewController.rewriteResumeSectionController)

// Get active AI model status and info
interviewRouter.get('/model-info', authMidleware.authUser, interviewController.getAiModelInfoController)

module.exports = interviewRouter
