const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/file.middleware');
const coverLetterController = require('../controller/coverletter.controller');

const coverLetterRouter = express.Router();

// Generate Cover Letter (takes file upload "resume")
coverLetterRouter.post('/', authMiddleware.authUser, upload.single("resume"), coverLetterController.createCoverLetterController);

// Generate Cover Letter directly from an existing interview report
coverLetterRouter.post('/generate-from-report/:interviewReportId', authMiddleware.authUser, coverLetterController.createCoverLetterFromReportController);

// Get list of cover letters
coverLetterRouter.get('/', authMiddleware.authUser, coverLetterController.getAllCoverLettersController);

// Get a single cover letter details
coverLetterRouter.get('/:coverLetterId', authMiddleware.authUser, coverLetterController.getCoverLetterByIdController);

// Get a cover letter by interview report id
coverLetterRouter.get('/report/:interviewReportId', authMiddleware.authUser, coverLetterController.getCoverLetterByReportIdController);

// Export PDF format of cover letter
coverLetterRouter.post('/pdf/:coverLetterId', authMiddleware.authUser, coverLetterController.generateCoverLetterPdfController);

// Update cover letter content
coverLetterRouter.put('/:coverLetterId', authMiddleware.authUser, coverLetterController.updateCoverLetterController);

// Delete cover letter
coverLetterRouter.delete('/:coverLetterId', authMiddleware.authUser, coverLetterController.deleteCoverLetterController);

module.exports = coverLetterRouter;
