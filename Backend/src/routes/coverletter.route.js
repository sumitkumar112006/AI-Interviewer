const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/file.middleware');
const coverLetterController = require('../controller/coverletter.controller');
const { createRateLimiter, fullGenerationLimiter } = require('../middleware/rateLimiter.middleware');

const coverLetterRouter = express.Router();

const CoverLetterRewriteLimiter = createRateLimiter({
    prefix: 'ratelimit:rewrite-cover-letter',
    windowSeconds: 60, // 1 minute
    maxRequests: 5,
    message: 'Rewrite cover letter limit reached. Please wait a minute before generating another cover letter.'
});

const checkCoverLetterAccess = (req, res, next) => {
    if (req.user?.blockedFeatures?.coverLetterGeneration) {
        return res.status(403).json({ message: "Cover Letter & CV generation has been disabled for your account by an administrator. ❌" });
    }
    next();
};

// Generate Cover Letter (takes file upload "resume")
coverLetterRouter.post('/', authMiddleware.authUser, checkCoverLetterAccess, fullGenerationLimiter, upload.single("resume"), coverLetterController.createCoverLetterController);

// Generate Cover Letter directly from an existing interview report
coverLetterRouter.post('/generate-from-report/:interviewReportId', authMiddleware.authUser, checkCoverLetterAccess, fullGenerationLimiter, coverLetterController.createCoverLetterFromReportController);

// Get list of cover letters
coverLetterRouter.get('/', authMiddleware.authUser, coverLetterController.getAllCoverLettersController);

// Get a single cover letter details
coverLetterRouter.get('/:coverLetterId', authMiddleware.authUser, coverLetterController.getCoverLetterByIdController);

// Get a cover letter by interview report id
coverLetterRouter.get('/report/:interviewReportId', authMiddleware.authUser, coverLetterController.getCoverLetterByReportIdController);

// Export PDF format of cover letter
coverLetterRouter.post('/pdf/:coverLetterId', authMiddleware.authUser, checkCoverLetterAccess, coverLetterController.generateCoverLetterPdfController);

// Update cover letter content
coverLetterRouter.put('/:coverLetterId', authMiddleware.authUser, checkCoverLetterAccess, CoverLetterRewriteLimiter, coverLetterController.updateCoverLetterController);

// Delete cover letter
coverLetterRouter.delete('/:coverLetterId', authMiddleware.authUser, coverLetterController.deleteCoverLetterController);

module.exports = coverLetterRouter;
