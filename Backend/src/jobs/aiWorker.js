const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const { createBullRedisConnection } = require('./redisConnection');
const JobModel = require('../models/job.model');
const interviewReportModel = require('../models/interviewReport.model');
const coverLetterModel = require('../models/coverLetter.model');
const { deleteCache } = require('../services/redis.service');
const { processReportSkills } = require('../services/skills.service');
const {
    generateInterviewReport,
    generateResumeHtml,
    generateCoverLetter,
    rewriteResumeSection
} = require('../services/ai.service');

let aiWorkerInstance = null;

function initAiWorker() {
    if (aiWorkerInstance) return aiWorkerInstance;

    const workerConnection = createBullRedisConnection();

    aiWorkerInstance = new Worker('ai-generation', async (bullJob) => {
        const { jobId } = bullJob.data;
        console.log(`[AI Worker] Starting Job ${jobId} (Type: ${bullJob.name})...`);

        const jobDoc = await JobModel.findById(jobId);
        if (!jobDoc) {
            console.error(`[AI Worker] Job document not found in DB: ${jobId}`);
            return;
        }

        if (jobDoc.status === 'done') {
            console.log(`[AI Worker] Job ${jobId} is already marked as done.`);
            return jobDoc.result;
        }

        // Mark as processing
        jobDoc.status = 'processing';
        await jobDoc.save();

        try {
            switch (jobDoc.type) {
                // 1. MOCK INTERVIEW & REPORT GENERATION
                case 'interview_report': {
                    const { resumeText, selfDescription, jobDescription, userPlan } = jobDoc.input;

                    const interviewReportByAI = await generateInterviewReport({
                        resume: resumeText,
                        selfDescription,
                        jobDescription,
                        plan: userPlan || 'free'
                    });

                    const detectedSkills = processReportSkills({
                        resume: resumeText,
                        selfDescription,
                        jobDescription,
                        ...interviewReportByAI
                    });

                    const userIdStr = jobDoc.userId?.toString();
                    const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr)
                        ? new mongoose.Types.ObjectId(userIdStr)
                        : jobDoc.userId;

                    const interviewReport = await interviewReportModel.create({
                        user: userObjectId,
                        resume: resumeText,
                        selfDescription,
                        jobDescription,
                        detectedSkills,
                        ...interviewReportByAI
                    });

                    // Invalidate reports list cache
                    await deleteCache(`cache:reports:user:${userIdStr}`);

                    jobDoc.resourceId = interviewReport._id;
                    jobDoc.resourceModel = 'InterviewReport';
                    jobDoc.result = interviewReport;
                    jobDoc.status = 'done';
                    jobDoc.creditDeducted = true;
                    await jobDoc.save();

                    console.log(`[AI Worker] Job ${jobId} (interview_report) finished successfully. Created Report: ${interviewReport._id}`);
                    return interviewReport;
                }

                // 2. RESUME HTML GENERATION
                case 'resume_html': {
                    const { interviewReportId, userPlan, forceRegenerate } = jobDoc.input;

                    const interviewReport = await interviewReportModel.findOne({
                        _id: interviewReportId,
                        user: jobDoc.userId
                    });

                    if (!interviewReport) {
                        throw new Error(`Interview report ${interviewReportId} not found`);
                    }

                    // If HTML exists and force is false, complete immediately
                    if (interviewReport.generatedResumeHtml && !forceRegenerate) {
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
                    const generatedHtml = await generateResumeHtml({
                        resume: resumeText || selfDescription || jobDescription,
                        selfDescription,
                        jobDescription,
                        plan: userPlan || 'free'
                    });

                    interviewReport.generatedResumeHtml = generatedHtml;
                    await interviewReport.save();

                    // Invalidate report detail cache
                    await deleteCache(`cache:report:${interviewReportId}:${jobDoc.userId}`);

                    jobDoc.resourceId = interviewReport._id;
                    jobDoc.resourceModel = 'InterviewReport';
                    jobDoc.result = interviewReport;
                    jobDoc.status = 'done';
                    jobDoc.creditDeducted = true;
                    await jobDoc.save();

                    console.log(`[AI Worker] Job ${jobId} (resume_html) finished successfully for Report: ${interviewReportId}`);
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
                    const { selectedText, instruction, action, message, plan } = jobDoc.input;

                    const aiResponse = await rewriteResumeSection({
                        selectedText,
                        instruction,
                        action,
                        message,
                        plan: plan || 'free'
                    });

                    jobDoc.result = {
                        replyText: aiResponse.replyText,
                        suggestedSnippet: aiResponse.suggestedSnippet,
                        rewrittenText: aiResponse.suggestedSnippet
                    };
                    jobDoc.status = 'done';
                    jobDoc.creditDeducted = true;
                    await jobDoc.save();

                    console.log(`[AI Worker] Job ${jobId} (rewrite_section) finished successfully.`);
                    return jobDoc.result;
                }

                default:
                    throw new Error(`Unknown job type: ${jobDoc.type}`);
            }
        } catch (err) {
            console.error(`[AI Worker] Job ${jobId} execution error:`, err);
            jobDoc.status = 'failed';
            jobDoc.error = err.message || 'Generation failed';
            jobDoc.creditDeducted = true; // API was called
            await jobDoc.save();
            throw err;
        }
    }, {
        connection: workerConnection,
        concurrency: 5
    });

    aiWorkerInstance.on('completed', (job) => {
        console.log(`[AI Worker] BullMQ completed job: ${job.id}`);
    });

    aiWorkerInstance.on('failed', (job, err) => {
        console.error(`[AI Worker] BullMQ failed job: ${job?.id}, Error: ${err.message}`);
    });

    return aiWorkerInstance;
}

module.exports = {
    initAiWorker
};
