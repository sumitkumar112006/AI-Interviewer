const pdfParse = require('pdf-parse')
const mongoose = require('mongoose')
const crypto = require('crypto')
const { parseResumeLinks, formatExtractedLinksForPrompt } = require('../services/linkExtractor.js')
const { calculateATSScore } = require('../services/atsScorer.js')
const { calculateAtsMatchScore } = require('../services/ats/atsEngine')
const { generateInterviewReport, generateResumePfd, generateResumeHtml, rewriteResumeSection, extractSkillsFromResumeHtml, getAIStatus } = require('../services/ai.service')
const interviewReportModle = require('../models/interviewReport.model')
const interviewReportModel = require('../models/interviewReport.model')
const userModel = require('../models/user.model')
const JobModel = require('../models/job.model')
const { enqueueAiJob } = require('../jobs/aiQueue')
const { getCache, setCache, deleteCache } = require('../services/redis.service')
const { processReportSkills, aggregateSkillAnalytics, compareResumeSkillsDiff } = require('../services/skills.service')
const { getUserGenCredits } = require('../middleware/rateLimiter.middleware')
const { invalidateChunkCache, invalidateRoadmapChunkCache, invalidateJdChunkCache } = require('../ai-assistant')

function isValidResumeHtmlContent(html) {
    if (!html || typeof html !== 'string') return false;
    const clean = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (clean.length < 30) return false;
    if (/^[a-f0-9]{24}$/i.test(clean)) return false;
    return true;
}

function extractPlainTextFromResume(content) {
    if (!content || typeof content !== 'string') return '';
    if (/<[a-z][\s\S]*>/i.test(content)) {
        return content
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<li[^>]*>/gi, '\n• ')
            .replace(/<\/p>|<\/div>|<\/li>|<br\s*\/?>|<\/h[1-6]>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s*\n+/g, '\n\n')
            .trim();
    }
    return content.trim();
}

async function generateInterviewReportController(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "Resume PDF file is required"
            })
        }

        const rawSelfDesc = req.body?.selfDescription?.trim();
        const savedSelfDesc = req.user?.careerProfile?.selfDescription?.trim();
        const effectiveSelfDescription = rawSelfDesc || savedSelfDesc || "";

        if (!req.body?.jobDescription?.trim()) {
            return res.status(400).json({
                message: "Job description is required"
            })
        }

        // Auto-save selfDescription if explicitly requested or if user currently has none saved
        if (rawSelfDesc && (req.body?.saveSelfDescription === true || req.body?.saveSelfDescription === 'true' || !savedSelfDesc)) {
            userModel.findByIdAndUpdate(req.user.id, {
                $set: { "careerProfile.selfDescription": rawSelfDesc }
            }).catch(err => console.error("Auto-save selfDescription error:", err.message));
        }

        // 1. Check for active pending/processing job for this user
        const existingJob = await JobModel.findOne({
            userId: req.user.id,
            type: 'interview_report',
            status: { $in: ['pending', 'processing'] }
        });

        if (existingJob) {
            return res.status(409).json({
                message: "An interview report generation is already running.",
                jobId: existingJob._id,
                status: existingJob.status,
                genCredits: req.genCredits
            });
        }

        // 2. Extract visible text and recover hidden hyperlinks & anchor associations
        let rawResumeText = '';
        try {
            const resumeContent = await (new pdfParse.PDFParse(Uint8Array.from(req.file.buffer))).getText();
            rawResumeText = resumeContent?.text || '';
        } catch (pdfErr) {
            console.warn('[Interview Controller] pdf-parse fallback notice:', pdfErr.message);
        }

        // Recover all hidden links, anchor text associations, and social/portfolio profiles
        let formattedLinksText = '';
        let extractedLinks = null;
        let rawLinks = [];
        try {
            const parsedLinksResult = await parseResumeLinks(req.file.buffer, req.file.mimetype || req.file.originalname);
            extractedLinks = parsedLinksResult?.links || null;
            rawLinks = parsedLinksResult?.rawLinks || [];
            formattedLinksText = formatExtractedLinksForPrompt(parsedLinksResult);
        } catch (linkErr) {
            console.warn('[Interview Controller] parseResumeLinks notice:', linkErr.message);
        }

        // Combine raw text with explicit link indicators for the LLM
        const effectiveResumeText = [rawResumeText, formattedLinksText].filter(Boolean).join('\n\n');

        const { jobDescription } = req.body;
        const userPlan = (req.user?.plan || "free").toLowerCase();

        // 3. Create Job document in MongoDB
        const job = await JobModel.create({
            userId: req.user.id,
            type: 'interview_report',
            resourceId: null,
            resourceModel: 'InterviewReport',
            status: 'pending',
            input: {
                resumeText: effectiveResumeText,
                rawResumeText,
                extractedLinks,
                rawLinks,
                selfDescription: effectiveSelfDescription,
                jobDescription,
                userPlan
            }
        });

        // 4. Enqueue to BullMQ
        await enqueueAiJob('interview_report', { jobId: job._id });

        // 5. Respond 202 Accepted immediately
        return res.status(202).json({
            message: "Interview report generation started.",
            jobId: job._id,
            status: 'pending',
            genCredits: req.genCredits
        });
    } catch (error) {
        console.error("generateInterviewReportController error:", error.message);
        if (req.refundGeneration) {
            try {
                await req.refundGeneration();
            } catch (refundErr) {
                console.error("Failed to refund generation credit:", refundErr.message);
            }
        }
        next(error)
    }
}

async function getInterviewReportByIdController(req, res, next) {
    try {
        const { interviewId } = req.params
        const userIdStr = req.user.id || req.user._id?.toString()
        const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : userIdStr

        if (!mongoose.isValidObjectId(interviewId)) {
            return res.status(400).json({
                message: "Invalid interview report id"
            })
        }

        const cacheKey = `cache:report:${interviewId}:${userIdStr}`
        const cachedReport = await getCache(cacheKey)

        if (cachedReport) {
            // Validate cached data doesn't contain corrupted ObjectId resume
            if (isValidResumeHtmlContent(cachedReport?.generatedResumeHtml)) {
                return res.status(200).json({
                    interviewReport: cachedReport
                })
            }
            // If cached report was corrupted, purge cache and reload from DB
            await deleteCache(cacheKey)
        }

        const interviewReport = await interviewReportModle.findOne({
            _id: interviewId,
            $or: [
                { user: userObjectId },
                { user: userIdStr }
            ]
        })

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found"
            })
        }

        // Auto-heal corrupted document: if generatedResumeHtml or resume is a raw ObjectId, clear it
        let reportModified = false;
        if (interviewReport.generatedResumeHtml && !isValidResumeHtmlContent(interviewReport.generatedResumeHtml)) {
            interviewReport.generatedResumeHtml = "";
            reportModified = true;
        }
        if (interviewReport.resume && /^[a-f0-9]{24}$/i.test(interviewReport.resume.trim())) {
            interviewReport.resume = "";
            reportModified = true;
        }
        if (reportModified) {
            await interviewReportModel.updateOne(
                { _id: interviewReport._id },
                { generatedResumeHtml: interviewReport.generatedResumeHtml, resume: interviewReport.resume }
            );
        }

        // Auto-heal / populate resumeSkills if missing
        if ((!interviewReport.resumeSkills || interviewReport.resumeSkills.length === 0) && interviewReport.generatedResumeHtml) {
            const extracted = extractSkillsFromResumeHtml(interviewReport.generatedResumeHtml);
            if (extracted.length > 0) {
                interviewReport.resumeSkills = extracted;
                await interviewReportModel.updateOne(
                    { _id: interviewReport._id },
                    { resumeSkills: extracted }
                );
            } else if (Array.isArray(interviewReport.detectedSkills) && interviewReport.detectedSkills.length > 0) {
                const detectedNames = interviewReport.detectedSkills.map(s => s.name);
                interviewReport.resumeSkills = detectedNames;
                await interviewReportModel.updateOne(
                    { _id: interviewReport._id },
                    { resumeSkills: detectedNames }
                );
            }
        }

        // Auto-heal / populate older and current skills in DB if missing
        if ((!interviewReport.currentSkills || !interviewReport.currentSkills.all || interviewReport.currentSkills.all.length === 0) && interviewReport.generatedResumeHtml) {
            const comparison = compareResumeSkillsDiff({
                originalResumeText: interviewReport.resume || '',
                currentResumeHtml: interviewReport.generatedResumeHtml || '',
                currentResumeSkills: interviewReport.resumeSkills || [],
                detectedSkills: interviewReport.detectedSkills || []
            });
            interviewReport.older = comparison.originalSkills;
            interviewReport.olderSkills = comparison.originalSkills;
            interviewReport.originalSkills = comparison.originalSkills;
            interviewReport.current = comparison.currentSkills;
            interviewReport.currentSkills = comparison.currentSkills;
            await interviewReportModel.updateOne(
                { _id: interviewReport._id },
                {
                    older: comparison.originalSkills,
                    olderSkills: comparison.originalSkills,
                    originalSkills: comparison.originalSkills,
                    current: comparison.currentSkills,
                    currentSkills: comparison.currentSkills
                }
            );
        }

        // Dynamically calculate and update ATS matchScore if resume & JD are present
        const effectiveResumeText = extractPlainTextFromResume(interviewReport.generatedResumeHtml || interviewReport.resume || '');
        const targetJdText = interviewReport.jobDescription || '';
        if (effectiveResumeText && targetJdText) {
            try {
                const atsResult = await calculateAtsMatchScore({ resume: effectiveResumeText, jobDescription: targetJdText });
                if (typeof atsResult?.overallScore === 'number') {
                    interviewReport.matchScore = atsResult.overallScore;
                    interviewReport.atsScoreBreakdown = atsResult.breakdown;
                    await interviewReportModel.updateOne(
                        { _id: interviewReport._id },
                        { matchScore: atsResult.overallScore, atsScoreBreakdown: atsResult.breakdown }
                    );
                }
            } catch (atsErr) {
                console.warn("[getInterviewReportByIdController] Dynamic ATS scoring notice:", atsErr.message);
            }
        }

        await setCache(cacheKey, interviewReport, 3600)

        res.status(200).json({
            interviewReport
        })
    } catch (error) {
        next(error)
    }
}

async function getAllInterviewReportController(req, res, next) {
    try {
        const userIdStr = req.user.id || req.user._id?.toString()
        const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : userIdStr
        const cacheKey = `cache:reports:user:${userIdStr}`
        const forceRefresh = req.query.refresh === 'true'

        if (!forceRefresh) {
            const cachedSummary = await getCache(cacheKey)
            if (cachedSummary && Array.isArray(cachedSummary.interviewReports) && cachedSummary.interviewReports.length > 0) {
                return res.status(200).json(cachedSummary)
            }
        }

        const interviewReports = await interviewReportModle
            .find({
                $or: [
                    { user: userObjectId },
                    { user: userIdStr }
                ]
            })
            .sort({ createdAt: -1 })

        const reportsWithHash = interviewReports.map(report => {
            const reportObj = report.toObject()
            const hash = crypto.createHash('md5').update(reportObj.resume || '').digest('hex')

            // If report doesn't have detectedSkills yet, process dynamically
            if (!reportObj.detectedSkills || reportObj.detectedSkills.length === 0) {
                reportObj.detectedSkills = processReportSkills(reportObj)
            }

            const techCount = Array.isArray(reportObj.technicalQuestions) ? reportObj.technicalQuestions.length : 0;
            const behavioralCount = Array.isArray(reportObj.behavioralQuestion) ? reportObj.behavioralQuestion.length : 0;
            const planCount = Array.isArray(reportObj.preparationPlan) ? reportObj.preparationPlan.length : 0;
            const completedCount = Array.isArray(reportObj.completedTasks) ? reportObj.completedTasks.length : 0;

            reportObj.counts = {
                technical: techCount,
                behavioral: behavioralCount,
                roadmap: planCount,
                completedRoadmap: completedCount
            };

            delete reportObj.resume
            delete reportObj.selfDescription
            delete reportObj.jobDescription
            delete reportObj.technicalQuestions
            delete reportObj.behavioralQuestion
            delete reportObj.preparationPlan
            delete reportObj.__v

            reportObj.resumeHash = hash
            return reportObj
        })

        const uniqueResumes = new Set(reportsWithHash.map(r => r.resumeHash))
        const skillAnalytics = aggregateSkillAnalytics(interviewReports)

        const responseData = {
            totalInterviews: reportsWithHash.length,
            totalResumes: uniqueResumes.size,
            skillAnalytics,
            interviewReports: reportsWithHash
        }

        if (reportsWithHash.length > 0) {
            await setCache(cacheKey, responseData, 600)
        } else {
            await deleteCache(cacheKey)
        }

        res.status(200).json(responseData)
    } catch (error) {
        next(error)
    }
}

async function getSkillAnalyticsController(req, res, next) {
    try {
        const userIdStr = req.user.id || req.user._id?.toString()
        const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : userIdStr

        const interviewReports = await interviewReportModle
            .find({
                $or: [
                    { user: userObjectId },
                    { user: userIdStr }
                ]
            })
            .sort({ createdAt: -1 })

        const skillAnalytics = aggregateSkillAnalytics(interviewReports)
        const careerProfile = req.user?.careerProfile || {
            selfDescription: "",
            targetRole: "Full Stack Developer",
            targetCompanies: ["Product Companies"],
            experienceLevel: "fresher",
            savedRoadmaps: []
        };

        res.status(200).json({
            message: "Skill analytics retrieved successfully",
            skillAnalytics,
            careerTarget: {
                targetRole: careerProfile.targetRole,
                targetCompanies: careerProfile.targetCompanies,
                experienceLevel: careerProfile.experienceLevel,
                selfDescription: careerProfile.selfDescription
            },
            savedRoadmaps: careerProfile.savedRoadmaps || []
        })
    } catch (error) {
        next(error)
    }
}

async function generateResumePdfController(req, res, next) {
    try {
        const { interviewReportId } = req.params
        const forceRegenerate = req.query.force === 'true' || req.body?.force === true

        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({
                message: "Invalid interview report id"
            })
        }

        const userIdStr = req.user.id || req.user._id?.toString()
        const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : userIdStr

        const interviewReport = await interviewReportModle.findOne({
            _id: interviewReportId,
            $or: [
                { user: userObjectId },
                { user: userIdStr }
            ]
        })

        if (!interviewReport) {
            return res.status(404).json({
                message: "Interview report not found"
            })
        }

        // If HTML already exists, is healthy, and force regeneration is not requested, return saved report as-is
        if (isValidResumeHtmlContent(interviewReport.generatedResumeHtml) && !forceRegenerate) {
            return res.status(200).json({ interviewReport, genCredits: req.genCredits })
        }

        // 1. Check for active pending/processing job for this specific report
        const existingJob = await JobModel.findOne({
            userId: userIdStr,
            type: 'resume_html',
            resourceId: interviewReportId,
            status: { $in: ['pending', 'processing'] }
        });

        if (existingJob) {
            return res.status(409).json({
                message: "Resume generation is already running for this report.",
                jobId: existingJob._id,
                status: existingJob.status,
                genCredits: req.genCredits
            });
        }

        // 2. Create Job document
        const userPlan = (req.user?.plan || "free").toLowerCase();
        const job = await JobModel.create({
            userId: req.user.id,
            type: 'resume_html',
            resourceId: interviewReportId,
            resourceModel: 'InterviewReport',
            status: 'pending',
            input: {
                interviewReportId,
                userPlan,
                forceRegenerate
            }
        });

        // 3. Enqueue to BullMQ
        await enqueueAiJob('resume_html', { jobId: job._id });

        // 4. Respond 202 Accepted immediately
        return res.status(202).json({
            message: "Resume generation started.",
            jobId: job._id,
            status: 'pending',
            genCredits: req.genCredits
        });
    } catch (error) {
        console.error("generateResumePdfController error:", error);
        if (req.refundGeneration) {
            try {
                await req.refundGeneration();
            } catch (refundErr) {
                console.error("Failed to refund generation credit:", refundErr.message);
            }
        }
        next(error)
    }
}

async function deleteReportById(req, res, next) {
    try {
        const { interviewReportId } = req.params;

        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({
                message: "Invalid interview report id"
            })
        }

        const deleteReport = await interviewReportModle.findOneAndDelete({
            _id: interviewReportId,
            user: req.user.id
        })

        if (!deleteReport) {
            return res.status(404).json({
                message: "Report not Found!",
            })
        }

        await deleteCache(`cache:report:${interviewReportId}:${req.user.id}`);
        await deleteCache(`cache:reports:user:${req.user.id}`);

        return res.status(200).json({
            message: "Report deleted successfully!",
            deletedReportId: interviewReportId
        });

    } catch (err) {
        console.error("deleteReportById error: ", err)
        next(err)
    }
}

async function updateResumeHtmlController(req, res, next) {
    try {
        const { interviewReportId } = req.params;
        const generatedResumeHtml = typeof req.body?.generatedResumeHtml === 'string'
            ? req.body.generatedResumeHtml
            : (typeof req.body?.html === 'string' ? req.body.html : null);

        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({ message: "Invalid report id" });
        }

        if (!isValidResumeHtmlContent(generatedResumeHtml)) {
            return res.status(400).json({ 
                message: "Valid resume content is required to update resume. Empty content or database IDs are not allowed." 
            });
        }

        const userIdStr = req.user.id || req.user._id?.toString();
        const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : userIdStr;

        const resumeSkills = Array.isArray(req.body?.resumeSkills)
            ? req.body.resumeSkills
            : (Array.isArray(req.body?.skills) ? req.body.skills : null);

        const query = { _id: interviewReportId };
        if (req.user?.role !== 'admin') {
            query.$or = [{ user: userObjectId }, { user: userIdStr }];
        }

        const existingReport = await interviewReportModel.findOne(query);

        if (!existingReport) {
            return res.status(404).json({ message: "Interview report not found" });
        }

        const comparison = compareResumeSkillsDiff({
            originalResumeText: existingReport.resume || '',
            currentResumeHtml: generatedResumeHtml,
            currentResumeSkills: Array.isArray(resumeSkills) && resumeSkills.length > 0 ? resumeSkills : (existingReport.resumeSkills || []),
            detectedSkills: existingReport.detectedSkills || []
        });

        const effectiveSkills = resumeSkills && Array.isArray(resumeSkills) && resumeSkills.length > 0
            ? resumeSkills
            : (comparison.currentSkills?.all || []).map(s => s.name);

        // Dynamically compute updated ATS match score on resume save
        const savedResumeText = extractPlainTextFromResume(generatedResumeHtml);
        const jdText = existingReport.jobDescription || '';
        let dynamicScore = existingReport.matchScore;
        let atsBreakdown = existingReport.atsScoreBreakdown || null;

        if (savedResumeText && jdText) {
            try {
                const atsResult = await calculateAtsMatchScore({ resume: savedResumeText, jobDescription: jdText });
                if (typeof atsResult?.overallScore === 'number') {
                    dynamicScore = atsResult.overallScore;
                    atsBreakdown = atsResult.breakdown;
                }
            } catch (atsErr) {
                console.warn("[updateResumeHtmlController] Dynamic ATS scoring notice:", atsErr.message);
            }
        }

        const updateData = {
            generatedResumeHtml,
            resumeSkills: effectiveSkills,
            older: comparison.originalSkills,
            olderSkills: comparison.originalSkills,
            originalSkills: comparison.originalSkills,
            current: comparison.currentSkills,
            currentSkills: comparison.currentSkills,
            matchScore: dynamicScore,
            atsScoreBreakdown: atsBreakdown
        };

        const report = await interviewReportModel.findByIdAndUpdate(
            interviewReportId,
            updateData,
            { returnDocument: 'after' }
        );

        // Invalidate report detail cache, user recent reports list cache & RAG chunk cache
        const cacheKey = `cache:report:${interviewReportId}:${userIdStr}`
        await deleteCache(cacheKey)
        await deleteCache(`cache:reports:user:${userIdStr}`)
        await invalidateChunkCache(interviewReportId)

        res.status(200).json({
            message: "Resume updated successfully!",
            interviewReport: report,
            matchScore: dynamicScore,
            atsScoreBreakdown: atsBreakdown
        });
    } catch (error) {
        next(error);
    }
}

async function updateInterviewProgressController(req, res, next) {
    try {
        const { interviewId } = req.params;
        const { technicalQuestions, behavioralQuestion, completedTasks, preparationPlan, jobDescription } = req.body;

        if (!mongoose.isValidObjectId(interviewId)) {
            return res.status(400).json({ message: "Invalid report id" });
        }

        const updateData = {};
        if (technicalQuestions !== undefined) updateData.technicalQuestions = technicalQuestions;
        if (behavioralQuestion !== undefined) updateData.behavioralQuestion = behavioralQuestion;
        if (completedTasks !== undefined) updateData.completedTasks = completedTasks;
        if (preparationPlan !== undefined) updateData.preparationPlan = preparationPlan;
        if (jobDescription !== undefined) updateData.jobDescription = jobDescription;

        const userIdStr = req.user.id || req.user._id?.toString();
        const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : userIdStr;

        const report = await interviewReportModel.findOneAndUpdate(
            {
                _id: interviewId,
                $or: [
                    { user: userObjectId },
                    { user: userIdStr }
                ]
            },
            updateData,
            { returnDocument: 'after' }
        );

        if (!report) {
            return res.status(404).json({ message: "Interview report not found" });
        }

        // Invalidate report detail cache & RAG chunk caches
        const cacheKey = `cache:report:${interviewId}:${userIdStr}`;
        await deleteCache(cacheKey);
        await invalidateRoadmapChunkCache(interviewId);
        await invalidateJdChunkCache(interviewId);

        res.status(200).json({
            message: "Interview progress updated successfully!",
            interviewReport: report
        });
    } catch (error) {
        next(error)
    }
}

async function rewriteResumeSectionController(req, res, next) {
    try {
        const { selectedText, instruction, action, message, resourceId, currentResumeHtml } = req.body;
        const plan = (req.user?.plan || 'free').toLowerCase();

        // If currentResumeHtml wasn't passed directly from client, load from MongoDB
        let effectiveResumeHtml = typeof currentResumeHtml === 'string' ? currentResumeHtml : '';
        let targetJobDescription = '';
        let targetJobRole = '';

        if (resourceId && mongoose.isValidObjectId(resourceId)) {
            const report = await interviewReportModel.findById(resourceId).select('generatedResumeHtml resume jobDescription developerTitle').lean();
            if (report) {
                if (!effectiveResumeHtml) {
                    effectiveResumeHtml = report.generatedResumeHtml || report.resume || '';
                }
                targetJobDescription = report.jobDescription || '';
                targetJobRole = report.developerTitle || '';
            }
        }

        // 1. Check for active pending/processing job
        const existingJob = await JobModel.findOne({
            userId: req.user.id,
            type: 'rewrite_section',
            resourceId: resourceId || null,
            status: { $in: ['pending', 'processing'] }
        });

        if (existingJob) {
            return res.status(409).json({
                message: "AI rewrite already in progress.",
                jobId: existingJob._id,
                status: existingJob.status
            });
        }

        // 2. Create Job document
        const job = await JobModel.create({
            userId: req.user.id,
            type: 'rewrite_section',
            resourceId: resourceId || null,
            resourceModel: 'InterviewReport',
            status: 'pending',
            input: {
                selectedText,
                instruction,
                action,
                message,
                plan,
                currentResumeHtml: effectiveResumeHtml,
                jobDescription: targetJobDescription,
                jobRole: targetJobRole,
                interviewReportId: resourceId
            }
        });

        // 3. Enqueue to BullMQ
        await enqueueAiJob('rewrite_section', { jobId: job._id });

        // 4. Respond 202 Accepted immediately
        return res.status(202).json({
            message: "Rewrite request started.",
            jobId: job._id,
            status: 'pending'
        });
    } catch (error) {
        next(error);
    }
}

async function getAiModelInfoController(req, res, next) {
    try {
        const genCredits = await getUserGenCredits(req.user);
        res.status(200).json({
            ...getAIStatus(),
            genCredits
        });
    } catch (error) {
        next(error);
    }
}

/**
 * @description Compares skills from the original uploaded resume vs. current generated/edited resume.
 * Returns an object containing all current skills categorized into two sub-arrays:
 * - newSkills: newly added skills (green)
 * - previousSkills: skills retained from original resume (blue)
 * as well as the combined list tagged with version and color metadata.
 * 
 * @route GET /api/interview/resume/skills-comparison/:interviewReportId
 * @access Private
 */
async function getResumeSkillsComparisonController(req, res, next) {
    try {
        const { interviewReportId } = req.params;

        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid interview report id"
            });
        }

        const userIdStr = req.user.id || req.user._id?.toString();
        const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : userIdStr;

        const report = await interviewReportModel.findOne({
            _id: interviewReportId,
            $or: [
                { user: userObjectId },
                { user: userIdStr }
            ]
        });

        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Interview report not found"
            });
        }

        // Compare original resume skills vs current resume skills using canonical service
        const comparison = compareResumeSkillsDiff({
            originalResumeText: report.resume || '',
            currentResumeHtml: report.generatedResumeHtml || '',
            currentResumeSkills: Array.isArray(report.resumeSkills) ? report.resumeSkills : [],
            detectedSkills: Array.isArray(report.detectedSkills) ? report.detectedSkills : []
        });

        // Persist older and current skills to DB if missing
        if (!report.currentSkills || !report.currentSkills.all || report.currentSkills.all.length === 0) {
            await interviewReportModel.updateOne(
                { _id: report._id },
                {
                    older: comparison.originalSkills,
                    olderSkills: comparison.originalSkills,
                    originalSkills: comparison.originalSkills,
                    current: comparison.currentSkills,
                    currentSkills: comparison.currentSkills
                }
            );
        }

        res.status(200).json({
            success: true,
            interviewReportId: report._id,
            developerTitle: report.developerTitle || 'Resume',
            skillsComparison: comparison
        });
    } catch (error) {
        console.error("getResumeSkillsComparisonController error:", error.message);
        next(error);
    }
}

async function calculateResumeAtsScoreController(req, res, next) {
    try {
        const { interviewReportId } = req.params;
        if (!mongoose.isValidObjectId(interviewReportId)) {
            return res.status(400).json({ message: "Invalid report id" });
        }

        const userIdStr = req.user.id || req.user._id?.toString();
        const userObjectId = mongoose.Types.ObjectId.isValid(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : userIdStr;

        const query = { _id: interviewReportId };
        if (req.user?.role !== 'admin') {
            query.$or = [{ user: userObjectId }, { user: userIdStr }];
        }

        const report = await interviewReportModel.findOne(query);

        if (!report) {
            return res.status(404).json({ message: "Interview report not found" });
        }

        const rawInput = req.body?.resumeHtml || req.body?.resumeText || report.generatedResumeHtml || report.resume || '';
        const resumeText = extractPlainTextFromResume(rawInput);
        const jdText = report.jobDescription || '';

        if (!resumeText) {
            return res.status(400).json({ message: "Resume content is required to calculate ATS score" });
        }

        const atsResult = await calculateAtsMatchScore({ resume: rawInput, jobDescription: jdText });
        const dynamicScore = atsResult.overallScore;

        const updateDoc = {
            matchScore: dynamicScore,
            atsScoreBreakdown: atsResult.breakdown
        };
        if (isValidResumeHtmlContent(req.body?.resumeHtml)) {
            updateDoc.generatedResumeHtml = req.body.resumeHtml;
        }

        // Persist dynamically calculated score to DB
        await interviewReportModel.updateOne(
            { _id: report._id },
            updateDoc
        );

        // Invalidate both report detail cache and user recent reports list cache
        const cacheKey = `cache:report:${interviewReportId}:${userIdStr}`;
        await deleteCache(cacheKey);
        await deleteCache(`cache:reports:user:${userIdStr}`);

        return res.status(200).json({
            success: true,
            matchScore: dynamicScore,
            breakdown: atsResult.breakdown,
            suggestions: atsResult.suggestions || []
        });
    } catch (error) {
        console.error("calculateResumeAtsScoreController error:", error.message);
        next(error);
    }
}

module.exports = {
    generateInterviewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportController,
    getSkillAnalyticsController,
    generateResumePdfController,
    deleteReportById,
    updateResumeHtmlController,
    updateInterviewProgressController,
    rewriteResumeSectionController,
    getAiModelInfoController,
    getResumeSkillsComparisonController,
    calculateResumeAtsScoreController
}