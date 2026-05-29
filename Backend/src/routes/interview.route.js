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

interviewRouter.post('/',authMidleware.authUser, upload.single("resume"), interviewController.generateInterviewReportController)

module.exports = interviewRouter