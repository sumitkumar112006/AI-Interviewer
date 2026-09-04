const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const jobController = require('../controller/job.controller');

const jobRouter = express.Router();

// GET /api/jobs/active?type=...&resourceId=...
jobRouter.get('/active', authMiddleware.authUser, jobController.getActiveJobController);

// GET /api/jobs/:jobId
jobRouter.get('/:jobId', authMiddleware.authUser, jobController.getJobStatusController);

module.exports = jobRouter;
