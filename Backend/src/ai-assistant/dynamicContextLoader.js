const mongoose = require('mongoose');
const { getRecentChatHistory } = require('./contextAssembler');
const interviewReportModel = require('../models/interviewReport.model');
const userModel = require('../models/user.model');

/**
 * Clean & Fast Dynamic Context Loader
 * Loads Target Job Description and Candidate Resume directly from MongoDB into the LLM context.
 * Bypasses heavy RAG vector embedding operations for instant sub-millisecond context delivery.
 * 
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.reportId]
 * @param {Object} params.intentData - Result from classifyIntent()
/**
 * Clean & Fast Dynamic Context Loader
 * Loads Target Job Description and/or Candidate Resume directly from MongoDB into the LLM context
 * ONLY when requested by the Unified Micro-Router.
 * 
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.reportId]
 * @param {Object} [params.contextNeeds] - { needs_resume: boolean, needs_jd: boolean, needs_roadmap: boolean }
 * @param {Object} [params.intentData]
 * @param {string} [params.promptText]
 * @param {string} [params.selectedText]
 * @returns {Promise<Object>} { candidateContextSnippet, recentHistory, profile, dbCallsAvoided, targetRole, companyName }
 */
async function loadDynamicContext({ userId, reportId = null, contextNeeds = null, intentData = null, promptText = '', selectedText = '' }) {
    const historyLimit = typeof intentData?.history_turns_needed === 'number' 
        ? intentData.history_turns_needed 
        : 2;

    const needsResume = contextNeeds ? Boolean(contextNeeds.needs_resume) : true;
    const needsJd = contextNeeds ? Boolean(contextNeeds.needs_jd) : true;
    const needsRoadmap = contextNeeds ? Boolean(contextNeeds.needs_roadmap) : false;

    // Skip DB on security alerts or if no context is needed at all
    if (intentData?.intent === 'SECURITY' || (!needsResume && !needsJd && !needsRoadmap && !selectedText)) {
        const recentHistory = historyLimit > 0 ? await getRecentChatHistory(userId, historyLimit) : [];
        return {
            candidateContextSnippet: '',
            recentHistory,
            profile: null,
            targetRole: 'Software Developer',
            companyName: '',
            dbCallsAvoided: true
        };
    }

    try {
        const isDbConnected = mongoose.connection.readyState === 1;
        const userObjectId = (userId && mongoose.Types.ObjectId.isValid(userId)) ? new mongoose.Types.ObjectId(userId) : userId;

        // Build report query with lean projection (Target JD + Resume Profile) ONLY if needsResume or needsJd or needsRoadmap
        let reportPromise = Promise.resolve(null);
        if (userObjectId && isDbConnected && (needsResume || needsJd || needsRoadmap)) {
            const selectFields = 'developerTitle jobDescription generatedResumeHtml resume detectedSkills preparationPlan completedTasks';

            if (reportId && mongoose.Types.ObjectId.isValid(reportId)) {
                reportPromise = interviewReportModel.findOne({
                    _id: new mongoose.Types.ObjectId(reportId),
                    $or: [{ user: userObjectId }, { user: userId.toString() }]
                }).select(selectFields).lean();
            } else {
                reportPromise = interviewReportModel.findOne({
                    $or: [{ user: userObjectId }, { user: userId.toString() }]
                }).sort({ createdAt: -1 }).select(selectFields).lean();
            }
        }

        // Build user query with lean projection
        let userPromise = Promise.resolve(null);
        if (userObjectId && isDbConnected) {
            userPromise = userModel.findById(userObjectId).select('name careerProfile skills projects').lean();
        }

        // Fetch parallel resources including bounded Redis history
        const [reportDoc, userDoc, recentHistory] = await Promise.all([
            reportPromise,
            userPromise,
            historyLimit > 0 ? getRecentChatHistory(userId, historyLimit) : Promise.resolve([])
        ]);

        const profile = {};
        const snippetParts = [];
        let targetRole = reportDoc?.developerTitle || 'Software Developer';
        let companyName = '';

        // ── A. Target Job Description Context (Injected ONLY when needsJd is true) ──
        if (needsJd && reportDoc && reportDoc.jobDescription && reportDoc.jobDescription.trim()) {
            const cleanJd = reportDoc.jobDescription
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?(p|div|li|h[1-6]|section|article)[^>]*>/gi, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&nbsp;/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            profile.targetRole = targetRole;
            profile.currentJobDescription = cleanJd.slice(0, 300);

            // Extract company name if detectable
            const companyMatch = cleanJd.match(/(?:at|company|client|organization|team at)\s+([A-Z][A-Za-z0-9&.\s]{2,25})/i);
            if (companyMatch) {
                companyName = companyMatch[1].trim();
            }

            if (cleanJd) {
                snippetParts.push(`[Target Job Description & Role Specifications]:\n"""\nTarget Role: ${profile.targetRole}\n\n${cleanJd}\n"""`);
            }
        }

        // ── B. Candidate Resume Context (Injected ONLY when needsResume is true) ──
        if (needsResume && reportDoc) {
            const resumeContent = reportDoc.generatedResumeHtml || reportDoc.resume;
            if (resumeContent && typeof resumeContent === 'string' && resumeContent.trim()) {
                const cleanFullResume = resumeContent
                    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n[Candidate Name]: $1\n')
                    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n[Resume Section: $1]\n')
                    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n  • Role/Entry: $1\n')
                    .replace(/<li[^>]*>/gi, '\n    - ')
                    .replace(/<\/li>/gi, '')
                    .replace(/<p[^>]*>/gi, '\n')
                    .replace(/<\/p>/gi, '\n')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();

                if (cleanFullResume) {
                    snippetParts.push(`[Candidate's Active Resume & Technical Profile]:\n"""\n${cleanFullResume}\n"""`);
                }
            }
        }

        // ── C. Stored Roadmap (Injected ONLY when needsRoadmap is true) ────────
        if (needsRoadmap && reportDoc && Array.isArray(reportDoc.preparationPlan) && reportDoc.preparationPlan.length > 0) {
            const completedSet = new Set((reportDoc.completedTasks || []).map(t => typeof t === 'string' ? t.trim().toLowerCase() : ''));
            const totalTasks = reportDoc.preparationPlan.reduce((acc, d) => acc + (Array.isArray(d?.tasks) ? d.tasks.length : 0), 0);
            const completedCount = completedSet.size;
            const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

            const roadmapLines = reportDoc.preparationPlan.map((d, idx) => {
                const dayLabel = d.day || `Day ${idx + 1}`;
                const focus = d.focus || 'Technical Milestone';
                const tasks = Array.isArray(d.tasks) ? d.tasks : [];
                const taskBullets = tasks.map(t => {
                    const isDone = completedSet.has(t.trim().toLowerCase());
                    return `    ${isDone ? '[✓ Done]' : '[○ Pending]'} ${t}`;
                }).join('\n');
                return `  • **${dayLabel}**: ${focus}\n${taskBullets}`;
            }).join('\n\n');

            snippetParts.push(`[Stored 14-Day Preparation Roadmap (${completedCount}/${totalTasks} Tasks Completed — ${progressPercent}%)]:\n${roadmapLines}`);
        }

        // ── D. Candidate User Profile Context ──────────────────────────────────
        if (userDoc && (needsResume || needsJd)) {
            const cp = userDoc.careerProfile || {};
            profile.candidateName = userDoc.name || 'Candidate';
            profile.experienceLevel = cp.experienceLevel || 'Mid-Level';
            profile.selfDescription = cp.selfDescription || '';

            let userSnippet = `[Candidate Profile]\n- Name: ${profile.candidateName}\n- Experience Level: ${profile.experienceLevel}`;
            if (profile.selfDescription) {
                userSnippet += `\n- Summary Pitch: "${profile.selfDescription}"`;
            }
            snippetParts.push(userSnippet);
        }

        const candidateContextSnippet = snippetParts.join('\n\n').trim();

        return {
            candidateContextSnippet,
            recentHistory,
            profile: Object.keys(profile).length > 0 ? profile : null,
            targetRole,
            companyName,
            dbCallsAvoided: !needsResume && !needsJd && !needsRoadmap
        };
    } catch (err) {
        console.error('[DynamicContextLoader] Context load failed:', err.message);
        const recentHistory = historyLimit > 0 ? await getRecentChatHistory(userId, historyLimit) : [];
        return {
            candidateContextSnippet: '',
            recentHistory,
            profile: null,
            targetRole: 'Software Developer',
            companyName: '',
            dbCallsAvoided: false
        };
    }
}

/**
 * On-Demand Stored Preparation Roadmap Fetcher (Used when LLM calls "roadmap" tool)
 */
async function fetchStoredRoadmap(reportId, userId) {
    try {
        if (!mongoose.connection.readyState) return null;
        const userObjectId = (userId && mongoose.Types.ObjectId.isValid(userId)) ? new mongoose.Types.ObjectId(userId) : userId;

        let query = {};
        if (reportId && mongoose.Types.ObjectId.isValid(reportId)) {
            query._id = new mongoose.Types.ObjectId(reportId);
        } else if (userObjectId) {
            query.$or = [{ user: userObjectId }, { user: userId.toString() }];
        } else {
            return null;
        }

        const report = await interviewReportModel.findOne(query)
            .select('preparationPlan completedTasks developerTitle matchScore skillGaps')
            .sort({ createdAt: -1 })
            .lean();

        if (!report || !Array.isArray(report.preparationPlan) || report.preparationPlan.length === 0) {
            return null;
        }

        const completedSet = new Set((report.completedTasks || []).map(t => typeof t === 'string' ? t.trim().toLowerCase() : ''));
        const totalTasks = report.preparationPlan.reduce((acc, d) => acc + (Array.isArray(d?.tasks) ? d.tasks.length : 0), 0);
        const completedCount = completedSet.size;
        const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

        const roadmapLines = report.preparationPlan.map((d, idx) => {
            const dayLabel = d.day || `Day ${idx + 1}`;
            const focus = d.focus || 'Technical Milestone';
            const tasks = Array.isArray(d.tasks) ? d.tasks : [];
            const taskBullets = tasks.map(t => {
                const isDone = completedSet.has(t.trim().toLowerCase());
                return `    ${isDone ? '[✓ Done]' : '[○ Pending]'} ${t}`;
            }).join('\n');
            return `  • **${dayLabel}**: ${focus}\n${taskBullets}`;
        }).join('\n\n');

        return `[Stored 14-Day Preparation Roadmap (${completedCount}/${totalTasks} Tasks Completed — ${progressPercent}%)]:\n${roadmapLines}`;
    } catch (e) {
        console.warn('[DynamicContextLoader] fetchStoredRoadmap notice:', e.message);
        return null;
    }
}

module.exports = {
    loadDynamicContext,
    fetchStoredRoadmap
};
