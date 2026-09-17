const mongoose = require('mongoose');
const { getRecentChatHistory, extractCompactJdSummary } = require('./contextAssembler');
const interviewReportModel = require('../models/interviewReport.model');
const userModel = require('../models/user.model');

/**
 * Selectively loads dynamic context from MongoDB and Redis based on the Classified Intent.
 * Bypasses MongoDB completely for 'TECH_CONCEPT' and 'PLATFORM_HELP' queries (0 DB queries).
 * 
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.reportId]
 * @param {Object} params.intentData - Result from classifyIntent()
 * @returns {Promise<Object>} { candidateContextSnippet, recentHistory, profile, dbCallsAvoided }
 */
async function loadDynamicContext({ userId, reportId = null, intentData }) {
    const historyLimit = typeof intentData?.history_turns_needed === 'number' 
        ? intentData.history_turns_needed 
        : 2;

    // 1. Zero DB Path (TECH_CONCEPT, PLATFORM_HELP, or any query where requires_context is false)
    if (!intentData?.requires_context || !intentData?.context_keys || intentData.context_keys.length === 0) {
        const recentHistory = historyLimit > 0 ? await getRecentChatHistory(userId, historyLimit) : [];
        return {
            candidateContextSnippet: '',
            recentHistory,
            profile: null,
            dbCallsAvoided: true
        };
    }

    // 2. Dynamic Selective DB Path
    const contextKeys = intentData.context_keys;
    const needsJob = contextKeys.some(k => k.startsWith('job.') || k.startsWith('resume.') || k === 'resume');
    const needsReport = contextKeys.some(k => k.startsWith('report.') || k === 'interview_report' || k === 'roadmap');
    const needsUser = contextKeys.some(k => k.startsWith('user.') || k === 'skills' || k === 'projects');

    try {
        const isDbConnected = mongoose.connection.readyState === 1;
        const userObjectId = (userId && mongoose.Types.ObjectId.isValid(userId)) ? new mongoose.Types.ObjectId(userId) : userId;

        // Build report query with tailored lean projection
        let reportPromise = Promise.resolve(null);
        if ((needsJob || needsReport) && userObjectId && isDbConnected) {
            let selectFields = 'developerTitle';
            if (needsJob) selectFields += ' jobDescription';
            if (needsReport) selectFields += ' matchScore skillGaps preparationPlan questions';

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
        if (needsUser && userObjectId && isDbConnected) {
            userPromise = userModel.findById(userObjectId).select('name careerProfile skills projects').lean();
        }

        // Fetch parallel resources including bounded Redis history
        const [reportDoc, userDoc, recentHistory] = await Promise.all([
            reportPromise,
            userPromise,
            historyLimit > 0 ? getRecentChatHistory(userId, historyLimit) : Promise.resolve([])
        ]);

        const profile = {};
        let snippetParts = [];

        // Format Job / Resume Target context if requested
        if (needsJob && reportDoc) {
            const compactJd = extractCompactJdSummary(reportDoc.jobDescription || '');
            profile.targetRole = reportDoc.developerTitle || 'Software Developer';
            profile.currentJobDescription = compactJd;

            snippetParts.push(`[Target Job & ATS Alignment]\n- Role: ${profile.targetRole}\n${compactJd ? `- Key Requirements / Keywords: "${compactJd}"\n` : ''}`);
        }

        // Format Interview Report Metrics & Preparation Plan if requested
        if (needsReport && reportDoc) {
            profile.matchScore = reportDoc.matchScore;
            profile.skillGaps = (reportDoc.skillGaps || []).slice(0, 4).map(g => g.skill).filter(Boolean);
            profile.preparationPlan = reportDoc.preparationPlan || [];
            
            let reportSnippet = `[Interview Assessment Metrics]\n- Role: ${reportDoc.developerTitle || 'Software Engineer'}\n- Readiness Score: ${reportDoc.matchScore || 'N/A'}%`;
            if (profile.skillGaps.length > 0) {
                reportSnippet += `\n- Identified Skill Gaps: ${profile.skillGaps.join(', ')}`;
            }
            if (Array.isArray(reportDoc.preparationPlan) && reportDoc.preparationPlan.length > 0) {
                const planItems = reportDoc.preparationPlan.slice(0, 7).map(p => `  • ${p.day || 'Day'}: **${p.focus || ''}** — ${(p.tasks || []).join('; ')}`).join('\n');
                reportSnippet += `\n\n[14-Day Preparation Roadmap from User's Stored Report]:\n${planItems}`;
            }
            snippetParts.push(reportSnippet);
        }

        // Format User Career Profile if requested
        if (needsUser && userDoc) {
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
            dbCallsAvoided: false
        };
    } catch (err) {
        console.error('[DynamicContextLoader] Selective load failed:', err.message);
        // Resilient fallback: Return empty context with history
        const recentHistory = historyLimit > 0 ? await getRecentChatHistory(userId, historyLimit) : [];
        return {
            candidateContextSnippet: '',
            recentHistory,
            profile: null,
            dbCallsAvoided: false
        };
    }
}

module.exports = {
    loadDynamicContext
};
