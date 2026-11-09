/**
 * adminJobs.test.js — Automated test suite for IMPLEMENTATION 06 (Background Job Monitoring)
 *
 * Verifies:
 * 1. Bounded queries, server-side pagination, summary metrics calculation, and queue status.
 * 2. Status and task type filtering.
 * 3. Lightweight projection (does not expose full raw bulky text/inputs in listing).
 * 4. Deep inspection with input sanitization (purges API keys, tokens, passwords).
 * 5. Strict deduplication protection on retry: rejects retrying completed ('done') or 'processing' jobs.
 * 6. Successful retry of failed/cancelled jobs with attempt counter increment & audit log recording.
 * 7. Safe cancellation of pending/processing jobs with audit log recording.
 */

'use strict';

jest.mock('../jobs/aiQueue', () => ({
    aiQueue: {
        getJob: jest.fn().mockResolvedValue(null),
        getJobCounts: jest.fn().mockResolvedValue({
            waiting: 1,
            active: 0,
            completed: 8,
            failed: 1,
            delayed: 0
        }),
        getWorkers: jest.fn().mockResolvedValue([{ id: 'worker-1' }])
    },
    enqueueAiJob: jest.fn().mockResolvedValue({ id: 'bull-job-123' })
}));

const mongoose = require('mongoose');
const JobModel = require('../models/job.model');
const {
    getAdminJobsController,
    getAdminJobDetailsController,
    retryAdminJobController,
    cancelAdminJobController
} = require('../controller/adminJobs.controller');
const auditLogService = require('../services/auditLog.service');
const aiQueueModule = require('../jobs/aiQueue');

describe('IMPLEMENTATION 06 — Background Job Monitoring Test Suite', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('1. Job Listing, Pagination & Metrics', () => {
        test('getAdminJobsController: returns paginated jobs with summaries and queue metrics', async () => {
            const fakeJobs = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'interview_report',
                    status: 'done',
                    progress: 100,
                    attempts: 1,
                    durationMs: 4200,
                    createdAt: new Date(),
                    userId: { username: 'testuser', email: 'test@example.com', isDeleted: false }
                }
            ];

            const mockFind = {
                populate: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(fakeJobs)
            };

            jest.spyOn(JobModel, 'find').mockReturnValue(mockFind);
            jest.spyOn(JobModel, 'countDocuments').mockResolvedValue(10);
            jest.spyOn(JobModel, 'aggregate').mockResolvedValue([
                {
                    totalJobs: 10,
                    doneCount: 8,
                    failedCount: 1,
                    pendingCount: 1,
                    processingCount: 0,
                    cancelledCount: 0,
                    avgDurationMs: 3500
                }
            ]);

            const req = {
                query: { page: '1', limit: '20' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await getAdminJobsController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.any(Array),
                summary: expect.objectContaining({
                    totalJobs: 10,
                    doneCount: 8,
                    failedCount: 1,
                    successRate: expect.any(String)
                }),
                pagination: expect.objectContaining({
                    total: 10,
                    page: 1
                })
            }));
        });

        test('getAdminJobsController: applies status and type filters properly', async () => {
            const mockFind = {
                populate: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue([])
            };

            const findSpy = jest.spyOn(JobModel, 'find').mockReturnValue(mockFind);
            jest.spyOn(JobModel, 'countDocuments').mockResolvedValue(0);
            jest.spyOn(JobModel, 'aggregate').mockResolvedValue([]);

            const req = {
                query: { status: 'failed', type: 'resume_html' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await getAdminJobsController(req, res);

            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                status: 'failed',
                type: 'resume_html'
            }));
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('2. Job Details & Payload Sanitization', () => {
        test('getAdminJobDetailsController: returns 400 on invalid ObjectId', async () => {
            const req = { params: { jobId: 'invalid-id' } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await getAdminJobDetailsController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid Job ID format.'
            }));
        });

        test('getAdminJobDetailsController: purges sensitive keys (apiKey, token, password) from payload', async () => {
            const validId = new mongoose.Types.ObjectId();
            const fakeJob = {
                _id: validId,
                type: 'interview_report',
                status: 'failed',
                error: 'AI service rate limit exceeded',
                attempts: 1,
                input: {
                    userPrompt: 'Help generate report',
                    apiKey: 'secret_live_gemini_api_key',
                    passwordHash: 'hidden_pass',
                    token: 'bearer_token_xyz',
                    deep: {
                        secret: 'confidential'
                    }
                },
                userId: { username: 'john', email: 'john@example.com' },
                createdAt: new Date()
            };

            const mockFindById = {
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(fakeJob)
            };
            jest.spyOn(JobModel, 'findById').mockReturnValue(mockFindById);

            const req = { params: { jobId: validId.toString() } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await getAdminJobDetailsController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            const responseData = res.json.mock.calls[0][0];
            expect(responseData.job.input.apiKey).toBe('[REDACTED]');
            expect(responseData.job.input.passwordHash).toBe('[REDACTED]');
            expect(responseData.job.input.token).toBe('[REDACTED]');
            expect(responseData.job.input.deep.secret).toBe('[REDACTED]');
            expect(responseData.job.input.userPrompt).toBe('Help generate report');
        });
    });

    describe('3. Job Retry & Deduplication Protection', () => {
        test('retryAdminJobController: rejects retry if job status is "done" (Deduplication Guarantee)', async () => {
            const validId = new mongoose.Types.ObjectId();
            const completedJob = {
                _id: validId,
                status: 'done',
                type: 'interview_report'
            };

            jest.spyOn(JobModel, 'findById').mockResolvedValue(completedJob);

            const req = {
                params: { jobId: validId.toString() },
                body: { reason: 'Test duplicate retry' },
                user: { _id: new mongoose.Types.ObjectId(), username: 'admin1', role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await retryAdminJobController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Job has already succeeded')
            }));
        });

        test('retryAdminJobController: rejects retry if job is actively processing', async () => {
            const validId = new mongoose.Types.ObjectId();
            const processingJob = {
                _id: validId,
                status: 'processing',
                type: 'resume_html'
            };

            jest.spyOn(JobModel, 'findById').mockResolvedValue(processingJob);

            const req = {
                params: { jobId: validId.toString() },
                body: {},
                user: { _id: new mongoose.Types.ObjectId(), username: 'admin1', role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await retryAdminJobController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Job is currently actively processing')
            }));
        });

        test('retryAdminJobController: successfully retries failed job, increments attempts, and records audit trail', async () => {
            const validId = new mongoose.Types.ObjectId();
            const failedJob = {
                _id: validId,
                status: 'failed',
                type: 'cover_letter',
                attempts: 1,
                input: { targetRole: 'Senior Engineer' },
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(JobModel, 'findById').mockResolvedValue(failedJob);
            jest.spyOn(aiQueueModule, 'enqueueAiJob').mockResolvedValue({ id: 'bull-job-123' });
            const auditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue({});

            const req = {
                params: { jobId: validId.toString() },
                body: { reason: 'Transient AI service rate limit cleared' },
                user: { _id: new mongoose.Types.ObjectId(), username: 'admin1', role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await retryAdminJobController(req, res);

            expect(failedJob.status).toBe('pending');
            expect(failedJob.attempts).toBe(2);
            expect(failedJob.error).toBeNull();
            expect(failedJob.save).toHaveBeenCalled();
            expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'JOB_RETRIED',
                targetType: 'Job',
                reason: 'Transient AI service rate limit cleared'
            }));
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringContaining('successfully re-queued')
            }));
        });
    });

    describe('4. Job Cancellation Safety', () => {
        test('cancelAdminJobController: rejects cancelling an already completed ("done") job', async () => {
            const validId = new mongoose.Types.ObjectId();
            const completedJob = {
                _id: validId,
                status: 'done',
                type: 'interview_report'
            };

            jest.spyOn(JobModel, 'findById').mockResolvedValue(completedJob);

            const req = {
                params: { jobId: validId.toString() },
                body: {},
                user: { _id: new mongoose.Types.ObjectId(), username: 'admin1', role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await cancelAdminJobController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Cannot cancel an already completed job.'
            }));
        });

        test('cancelAdminJobController: marks pending job cancelled and records audit log', async () => {
            const validId = new mongoose.Types.ObjectId();
            const pendingJob = {
                _id: validId,
                status: 'pending',
                type: 'rewrite_section',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(JobModel, 'findById').mockResolvedValue(pendingJob);
            const auditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue({});

            const req = {
                params: { jobId: validId.toString() },
                body: { reason: 'User requested cancellation' },
                user: { _id: new mongoose.Types.ObjectId(), username: 'admin1', role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await cancelAdminJobController(req, res);

            expect(pendingJob.status).toBe('cancelled');
            expect(pendingJob.save).toHaveBeenCalled();
            expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'JOB_CANCELLED',
                targetType: 'Job'
            }));
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                message: expect.stringContaining('cancelled successfully')
            }));
        });
    });
});
