const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const { trace, context, ROOT_CONTEXT, propagation, SpanKind, SpanStatusCode } = require('@opentelemetry/api');
const { logger } = require('../telemetry/logger');

const tracer = trace.getTracer('kivi-backend');
const { createBullRedisConnection } = require('./redisConnection');
const JobModel = require('../models/job.model');
const interviewReportModel = require('../models/interviewReport.model');
const coverLetterModel = require('../models/coverLetter.model');
const { deleteCache } = require('../services/redis.service');
const { processReportSkills, compareResumeSkillsDiff } = require('../services/skills.service');
const {
    generateInterviewReport,
    generateResumeHtml,
    generateCoverLetter,
    rewriteResumeSection
} = require('../services/ai.service');

let aiWorkerInstance = null;
let workerConnection = null;

function initAiWorker() {
    if (aiWorkerInstance) return aiWorkerInstance;

    workerConnection = createBullRedisConnection();

    aiWorkerInstance = new Worker('ai-generation', async (bullJob) => {
        const { jobId } = bullJob.data || {};

        // Extract W3C Trace Context from BullMQ job metadata
        let parentContext = ROOT_CONTEXT;
        try {
            if (bullJob.data?.otelTraceContext && typeof bullJob.data.otelTraceContext === 'object') {
                parentContext = propagation.extract(ROOT_CONTEXT, bullJob.data.otelTraceContext);
            }
        } catch {
            parentContext = ROOT_CONTEXT;
        }

        return await context.with(parentContext, async () => {
            return await tracer.startActiveSpan('kivi.ai.job', {
                kind: SpanKind.CONSUMER,
                attributes: {
                    'messaging.system': 'bullmq',
                    'messaging.destination': 'ai-generation',
                    'messaging.operation': 'process',
                    'kivi.job.type': bullJob.name || 'unknown',
                    'kivi.processing.mode': 'async_worker'
                }
            }, async (jobSpan) => {
                logger.info(`[AI Worker] Starting Job ${jobId} (Type: ${bullJob.name})...`, {
                    jobType: bullJob.name
                });

                const jobDoc = await JobModel.findById(jobId);
                if (!jobDoc) {
                    logger.error(`[AI Worker] Job document not found in DB: ${jobId}`);
                    jobSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'Job document not found in DB' });
                    jobSpan.setAttribute('kivi.job.status', 'not_found');
                    return;
                }

                if (jobDoc.status === 'done') {
                    logger.info(`[AI Worker] Job ${jobId} is already marked as done.`, { jobType: bullJob.name });
                    jobSpan.setStatus({ code: SpanStatusCode.OK });
                    jobSpan.setAttribute('kivi.job.status', 'already_done');
                    return jobDoc.result;
                }

                // Mark as processing
                jobDoc.status = 'processing';
                await jobDoc.save();

                try {
                    switch (jobDoc.type) {
                // 1. MOCK INTERVIEW & REPORT GENERATION (STAGE 1: Resume First, STAGE 2: Report Second)
                case 'interview_report': {
                    const { resumeText, selfDescription, jobDescription, userPlan, extractedLinks } = jobDoc.input;

                    const userIdStr = jobDoc.userId?.toString();
                    const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr)
                        ? new mongoose.Types.ObjectId(userIdStr)
                        : jobDoc.userId;

                    // 1. Check if an InterviewReport document already exists for this job (e.g. on BullMQ retry)
                    let interviewReport = null;
                    if (jobDoc.resourceId && mongoose.isValidObjectId(jobDoc.resourceId)) {
                        interviewReport = await interviewReportModel.findById(jobDoc.resourceId);
                    }

                    // ── STAGE 1: Generate ATS-Optimized Resume (First Priority) ──
                    let generatedResumeHtml = interviewReport?.generatedResumeHtml || '';
                    let resumeSkills = Array.isArray(interviewReport?.resumeSkills) && interviewReport.resumeSkills.length > 0 
                        ? interviewReport.resumeSkills 
                        : [];

                    // Only generate resume if not already generated & saved (retry-safe & idempotent)
                    if (!generatedResumeHtml || generatedResumeHtml.trim().length < 30) {
                        logger.info(`[AI Worker] Job ${jobId}: Stage 1 - Generating ATS-optimized resume first...`);
                        const resumeValue = await generateResumeHtml({
                            resume: resumeText || selfDescription || jobDescription,
                            selfDescription,
                            jobDescription,
                            plan: userPlan || 'free'
                        });

                        generatedResumeHtml = typeof resumeValue === 'object' && resumeValue?.html ? resumeValue.html : (resumeValue || '');
                        resumeSkills = typeof resumeValue === 'object' && Array.isArray(resumeValue?.skills) ? resumeValue.skills : [];
                    } else {
                        logger.info(`[AI Worker] Job ${jobId}: Stage 1 - Reusing existing saved ATS resume for retry.`);
                    }

                    // Save Stage 1 generated resume immediately to InterviewReport document
                    if (!interviewReport) {
                        const stage1Comparison = compareResumeSkillsDiff({
                            originalResumeText: resumeText || '',
                            currentResumeHtml: generatedResumeHtml || '',
                            currentResumeSkills: resumeSkills,
                            detectedSkills: []
                        });

                        interviewReport = await interviewReportModel.create({
                            user: userObjectId,
                            resume: resumeText,
                            selfDescription,
                            jobDescription,
                            detectedSkills: [],
                            resumeSkills: resumeSkills.length > 0 ? resumeSkills : (stage1Comparison.currentSkills?.all || []).map(s => s.name),
                            resumeLinks: extractedLinks || null,
                            older: stage1Comparison.originalSkills || [],
                            olderSkills: stage1Comparison.originalSkills || [],
                            originalSkills: stage1Comparison.originalSkills || [],
                            current: stage1Comparison.currentSkills || { all: [], newSkills: [], previousSkills: [] },
                            currentSkills: stage1Comparison.currentSkills || { all: [], newSkills: [], previousSkills: [] },
                            generatedResumeHtml,
                            developerTitle: 'ATS Tailored Resume',
                            matchScore: 0,
                            technicalQuestions: [],
                            behavioralQuestion: [],
                            skillGaps: [],
                            preparationPlan: []
                        });
                        jobDoc.resourceId = interviewReport._id;
                        jobDoc.resourceModel = 'InterviewReport';
                        await jobDoc.save();
                    } else if (generatedResumeHtml && interviewReport.generatedResumeHtml !== generatedResumeHtml) {
                        interviewReport.generatedResumeHtml = generatedResumeHtml;
                        if (resumeSkills.length > 0) interviewReport.resumeSkills = resumeSkills;
                        await interviewReport.save();
                    }

                    // Invalidate reports list cache so the initial report document is visible
                    await deleteCache(`cache:reports:user:${userIdStr}`);

                    // ── STAGE 2: Generate Interview Report + Questions + Roadmap (Second Priority) ──
                    // Pass: Original Resume + Newly Generated Resume + Job Description + Candidate Info
                    logger.info(`[AI Worker] Job ${jobId}: Stage 2 - Generating Interview Report with newly generated resume context...`);
                    const interviewReportByAI = await generateInterviewReport({
                        resume: resumeText,
                        selfDescription,
                        jobDescription,
                        plan: userPlan || 'free',
                        generatedResume: generatedResumeHtml
                    });

                    const detectedSkills = processReportSkills({
                        resume: resumeText,
                        selfDescription,
                        jobDescription,
                        ...interviewReportByAI
                    });

                    const comparison = compareResumeSkillsDiff({
                        originalResumeText: resumeText || '',
                        currentResumeHtml: generatedResumeHtml || '',
                        currentResumeSkills: resumeSkills,
                        detectedSkills
                    });

                    const finalResumeSkills = resumeSkills.length > 0 ? resumeSkills : (comparison.currentSkills?.all || []).map(s => s.name);

                    // Idempotently update the existing InterviewReport document with complete Stage 2 data
                    interviewReport = await interviewReportModel.findByIdAndUpdate(
                        interviewReport._id,
                        {
                            $set: {
                                developerTitle: interviewReportByAI.developerTitle || 'Assessment Report',
                                matchScore: interviewReportByAI.matchScore ?? 0,
                                technicalQuestions: interviewReportByAI.technicalQuestions || [],
                                behavioralQuestion: interviewReportByAI.behavioralQuestion || [],
                                skillGaps: interviewReportByAI.skillGaps || [],
                                preparationPlan: interviewReportByAI.preparationPlan || [],
                                detectedSkills,
                                resumeSkills: finalResumeSkills,
                                older: comparison.originalSkills,
                                olderSkills: comparison.originalSkills,
                                originalSkills: comparison.originalSkills,
                                current: comparison.currentSkills,
                                currentSkills: comparison.currentSkills,
                                generatedResumeHtml
                            }
                        },
                        { new: true }
                    );

                    // Invalidate cache with final report data
                    await deleteCache(`cache:reports:user:${userIdStr}`);

                    // Non-blocking background chunk & embedding pre-warming for Roadmap, JD, and Resume RAG
                    setImmediate(async () => {
                        try {
                            const { parseRoadmap, parseJobDescription, parseResumeHtml } = require('../ai-assistant/Chunker');
                            const { getOrEmbedRoadmapChunks, getOrEmbedJdChunks, getOrEmbedChunks } = require('../ai-assistant/Embedder');
                            const repIdStr = interviewReport._id.toString();

                            if (Array.isArray(interviewReport.preparationPlan) && interviewReport.preparationPlan.length > 0) {
                                const rChunks = parseRoadmap(interviewReport.preparationPlan, interviewReport.completedTasks || []);
                                await getOrEmbedRoadmapChunks(repIdStr, rChunks);
                            }
                            if (interviewReport.jobDescription) {
                                const jdChunks = parseJobDescription(interviewReport.jobDescription, interviewReport.developerTitle || '');
                                await getOrEmbedJdChunks(repIdStr, jdChunks);
                            }
                            if (generatedResumeHtml) {
                                const resumeChunks = parseResumeHtml(generatedResumeHtml);
                                await getOrEmbedChunks(repIdStr, resumeChunks);
                            }
                        } catch (ragErr) {
                            console.warn('[AI Worker] Non-critical RAG pre-warming notice:', ragErr.message);
                        }
                    });

                    jobDoc.resourceId = interviewReport._id;
                    jobDoc.resourceModel = 'InterviewReport';
                    jobDoc.result = interviewReport;
                    jobDoc.status = 'done';
                    jobDoc.creditDeducted = true;
                    await jobDoc.save();

                    logger.info(`[AI Worker] Job ${jobId} (interview_report) finished successfully. Created Report: ${interviewReport._id}`);
                    jobSpan.setStatus({ code: SpanStatusCode.OK });
                    jobSpan.setAttribute('kivi.job.status', 'completed');
                    return interviewReport;
                }

                // 2. RESUME HTML GENERATION
                case 'resume_html': {
                    const { interviewReportId, userPlan, forceRegenerate } = jobDoc.input;
                    const userIdStr = jobDoc.userId?.toString();
                    const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr)
                        ? new mongoose.Types.ObjectId(userIdStr)
                        : jobDoc.userId;

                    const interviewReport = await interviewReportModel.findOne({
                        _id: interviewReportId,
                        $or: [
                            { user: userObjectId },
                            { user: userIdStr }
                        ]
                    });

                    if (!interviewReport) {
                        throw new Error(`Interview report ${interviewReportId} not found`);
                    }

                    const cleanExistingHtml = (interviewReport.generatedResumeHtml || '').replace(/<[^>]*>/g, '').trim();
                    const isExistingHealthy = cleanExistingHtml.length >= 30 && !/^[a-f0-9]{24}$/i.test(cleanExistingHtml);

                    // If HTML exists and is healthy, and force is false, complete immediately
                    if (isExistingHealthy && !forceRegenerate) {
                        jobDoc.result = interviewReport;
                        jobDoc.status = 'done';
                        await jobDoc.save();
                        return interviewReport;
                    }

                    let resumeText = (interviewReport.resume || '').trim();
                    if (/^[a-f0-9]{24}$/i.test(resumeText)) {
                        resumeText = '';
                    }

                    const { selfDescription, jobDescription } = interviewReport;
                    const resumeOutput = await generateResumeHtml({
                        resume: resumeText || selfDescription || jobDescription,
                        selfDescription,
                        jobDescription,
                        plan: userPlan || 'free'
                    });

                    const generatedHtml = typeof resumeOutput === 'object' && resumeOutput?.html ? resumeOutput.html : (resumeOutput || '');
                    const resumeSkills = typeof resumeOutput === 'object' && Array.isArray(resumeOutput?.skills) ? resumeOutput.skills : [];

                    interviewReport.generatedResumeHtml = generatedHtml;
                    if (resumeSkills.length > 0) {
                        interviewReport.resumeSkills = resumeSkills;
                    }

                    const comparison = compareResumeSkillsDiff({
                        originalResumeText: interviewReport.resume || '',
                        currentResumeHtml: generatedHtml,
                        currentResumeSkills: resumeSkills,
                        detectedSkills: interviewReport.detectedSkills || []
                    });

                    interviewReport.older = comparison.originalSkills;
                    interviewReport.olderSkills = comparison.originalSkills;
                    interviewReport.originalSkills = comparison.originalSkills;
                    interviewReport.current = comparison.currentSkills;
                    interviewReport.currentSkills = comparison.currentSkills;
                    await interviewReport.save();

                    // Invalidate report detail cache
                    await deleteCache(`cache:report:${interviewReportId}:${jobDoc.userId}`);

                    // Non-blocking background chunk & embedding pre-warming for Resume RAG
                    setImmediate(async () => {
                        try {
                            const { parseResumeHtml } = require('../ai-assistant/Chunker');
                            const { getOrEmbedChunks } = require('../ai-assistant/Embedder');
                            if (generatedHtml) {
                                const rChunks = parseResumeHtml(generatedHtml);
                                await getOrEmbedChunks(interviewReportId.toString(), rChunks);
                            }
                        } catch (ragErr) {
                            console.warn('[AI Worker] Non-critical Resume RAG pre-warming notice:', ragErr.message);
                        }
                    });

                    jobDoc.resourceId = interviewReport._id;
                    jobDoc.resourceModel = 'InterviewReport';
                    jobDoc.result = interviewReport;
                    jobDoc.status = 'done';
                    jobDoc.creditDeducted = true;
                    await jobDoc.save();

                    logger.info(`[AI Worker] Job ${jobId} (resume_html) finished successfully for Report: ${interviewReportId}`);
                    jobSpan.setStatus({ code: SpanStatusCode.OK });
                    jobSpan.setAttribute('kivi.job.status', 'completed');
                    return interviewReport;
                }

                // 3. COVER LETTER (FROM UPLOAD)
                case 'cover_letter': {
                    const { resumeText, selfDescription, jobDescription, companyName, roleName } = jobDoc.input;

                    const coverLetterHtml = await generateCoverLetter({
                        resume: resumeText,
                        selfDescription,
                        jobDescription,
                        companyName,
                        roleName
                    });

                    const coverLetter = await coverLetterModel.create({
                        user: jobDoc.userId,
                        resume: resumeText,
                        jobDescription,
                        selfDescription,
                        companyName,
                        roleName,
                        generatedContent: coverLetterHtml
                    });

                    jobDoc.resourceId = coverLetter._id;
                    jobDoc.resourceModel = 'CoverLetter';
                    jobDoc.result = coverLetter;
                    jobDoc.status = 'done';
                    jobDoc.creditDeducted = true;
                    await jobDoc.save();

                    console.log(`[AI Worker] Job ${jobId} (cover_letter) finished successfully. Created Cover Letter: ${coverLetter._id}`);
                    return coverLetter;
                }

                // 4. COVER LETTER (FROM REPORT)
                case 'cover_letter_report': {
                    const { interviewReportId, companyName, roleName } = jobDoc.input;

                    const interviewReport = await interviewReportModel.findOne({
                        _id: interviewReportId,
                        user: jobDoc.userId
                    });

                    if (!interviewReport) {
                        throw new Error(`Interview report ${interviewReportId} not found`);
                    }

                    const { resume, selfDescription, jobDescription } = interviewReport;

                    const coverLetterHtml = await generateCoverLetter({
                        resume,
                        selfDescription,
                        jobDescription,
                        companyName,
                        roleName
                    });

                    const coverLetter = await coverLetterModel.findOneAndUpdate(
                        { interviewReport: interviewReportId, user: jobDoc.userId },
                        {
                            user: jobDoc.userId,
                            interviewReport: interviewReportId,
                            resume,
                            jobDescription,
                            selfDescription,
                            companyName,
                            roleName,
                            generatedContent: coverLetterHtml
                        },
                        { upsert: true, returnDocument: 'after' }
                    );

                    jobDoc.resourceId = coverLetter._id;
                    jobDoc.resourceModel = 'CoverLetter';
                    jobDoc.result = coverLetter;
                    jobDoc.status = 'done';
                    jobDoc.creditDeducted = true;
                    await jobDoc.save();

                    console.log(`[AI Worker] Job ${jobId} (cover_letter_report) finished successfully for Report: ${interviewReportId}`);
                    return coverLetter;
                }

                // 5. REWRITE RESUME SECTION
                case 'rewrite_section': {
                    const { selectedText, instruction, action, message, plan, currentResumeHtml, jobDescription, jobRole } = jobDoc.input;

                    const aiResponse = await rewriteResumeSection({
                        selectedText,
                        instruction,
                        action,
                        message,
                        plan: plan || 'free',
                        currentResumeHtml: currentResumeHtml || '',
                        jobDescription: jobDescription || '',
                        jobRole: jobRole || ''
                    });

                    jobDoc.result = {
                        replyText: aiResponse.replyText,
                        targetText: aiResponse.targetText || null,
                        suggestedSnippet: aiResponse.suggestedSnippet,
                        rewrittenText: aiResponse.suggestedSnippet
                    };
                    jobDoc.status = 'done';
                    jobDoc.creditDeducted = true;
                    await jobDoc.save();

                    logger.info(`[AI Worker] Job ${jobId} (rewrite_section) finished successfully. Target text: ${aiResponse.targetText ? 'Identified' : 'None'}`);
                    jobSpan.setStatus({ code: SpanStatusCode.OK });
                    jobSpan.setAttribute('kivi.job.status', 'completed');
                    return jobDoc.result;
                }

                default:
                    throw new Error(`Unknown job type: ${jobDoc.type}`);
            }
                } catch (err) {
                    jobSpan.recordException(err);
                    jobSpan.setStatus({ code: SpanStatusCode.ERROR, message: err?.message || 'AI job execution failed' });
                    jobSpan.setAttribute('kivi.job.status', 'failed');
                    logger.error(`[AI Worker] Job ${jobId} execution error: ${err.message}`, {
                        error: err,
                        jobType: bullJob.name
                    });
                    jobDoc.status = 'failed';
                    jobDoc.error = err.message || 'Generation failed';
                    jobDoc.creditDeducted = true; // API was called
                    await jobDoc.save();
                    throw err;
                } finally {
                    jobSpan.end();
                }
            });
        });
    }, {
        connection: workerConnection,
        concurrency: 5
    });

    aiWorkerInstance.on('completed', (job) => {
        logger.info(`[AI Worker] BullMQ completed job: ${job.id}`, { jobType: job.name });
    });

    aiWorkerInstance.on('failed', (job, err) => {
        logger.error(`[AI Worker] BullMQ failed job: ${job?.id}, Error: ${err.message}`, {
            error: err,
            jobType: job?.name
        });
    });

    return aiWorkerInstance;
}

async function closeAiWorker(force = false) {
    if (!aiWorkerInstance) {
        if (workerConnection) {
            try {
                await workerConnection.quit();
            } catch {
                workerConnection.disconnect();
            } finally {
                workerConnection = null;
            }
        }
        return;
    }

    const worker = aiWorkerInstance;
    aiWorkerInstance = null;

    try {
        await worker.close(force);
    } finally {
        if (workerConnection) {
            try {
                await workerConnection.quit();
            } catch {
                workerConnection.disconnect();
            } finally {
                workerConnection = null;
            }
        }
    }
}

function getAiWorker() {
    return aiWorkerInstance;
}

module.exports = {
    initAiWorker,
    closeAiWorker,
    getAiWorker
};
