const express = require('express')
const authMidleware = require('../middleware/auth.middleware')
const interviewController = require('../controller/interview.controller')
const upload = require('../middleware/file.middleware')

const interviewRouter = express.Router();


/**
 * @route POST /api/interview
 * @description generate new interview report on the bassis of user self description, resume and job description.
 * @access private
 */

interviewRouter.post('/', authMidleware.authUser, upload.single("resume"), interviewController.generateInterviewReportController)

/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interview id.
 * @access private
 */
interviewRouter.get('/report/:interviewId', authMidleware.authUser, interviewController.getInterviewReportByIdController)

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

module.exports = interviewRouter
