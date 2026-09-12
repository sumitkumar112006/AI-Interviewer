const mongoose = require('mongoose');
const { getCache, setCache } = require('../services/redis.service');
const interviewReportModel = require('../models/interviewReport.model');
const userModel = require('../models/user.model');

/**
 * Retrieves the recent chat conversation turns from Redis Working Memory
 * @param {string} userId 
 * @param {number} maxTurns 
 * @returns {Promise<Array>} Array of { role: 'user' | 'assistant', content: string }
 */
async function getRecentChatHistory(userId, maxTurns = 6) {
    if (!userId) return [];
    const cacheKey = `chat:session:${userId}`;
    try {
        const history = await getCache(cacheKey);
        if (Array.isArray(history)) {
            return history.slice(-maxTurns);
        }
    } catch (err) {
        console.error('[Context Assembler] Redis session fetch failed:', err.message);
    }
    return [];
}

/**
 * Appends a new turn to the Redis Working Memory with a 1-hour (3600s) TTL
 */
async function appendChatTurn(userId, userMessage, assistantReply, maxHistory = 10) {
    if (!userId) return;
    const cacheKey = `chat:session:${userId}`;
    try {
        let history = (await getCache(cacheKey)) || [];
        if (!Array.isArray(history)) history = [];

        history.push({ role: 'user', content: userMessage });
        history.push({ role: 'assistant', content: assistantReply });

        // Keep only current session turns
        if (history.length > maxHistory * 2) {
            history = history.slice(-maxHistory * 2);
        }

        // Save only current active chat history with strict 1-hour (3600s) TTL in Redis
        await setCache(cacheKey, history, 3600);
    } catch (err) {
        console.error('[Context Assembler] Redis session append failed:', err.message);
    }
}

/**
 * Extracts a concise, high-signal JD summary (~50-80 words) to prevent token bloat
 */
function extractCompactJdSummary(rawJd = '') {
    if (!rawJd || typeof rawJd !== 'string') return '';
    const clean = rawJd.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (clean.length <= 320) return clean;
    return clean.slice(0, 320) + '...';
}

/**
 * Fetches ONLY the candidate's core profile information (no multi-report aggregation)
 * and the specific current report's Job Description & target role.
 * 
 * @param {string} userId 
 * @param {string} [reportId] - ID of the currently open report/resume (if any)
 * @returns {Promise<Object>} Clean candidate profile & current job context
 */
async function getCandidateMemoryProfile(userId, reportId = null) {
    if (!userId) return null;

    try {
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

        // Build query for the current specific report
        let reportQuery = null;
        if (reportId && mongoose.Types.ObjectId.isValid(reportId)) {
            reportQuery = interviewReportModel.findOne({
                _id: new mongoose.Types.ObjectId(reportId),
                $or: [{ user: userObjectId }, { user: userId.toString() }]
            }).select('developerTitle jobDescription matchScore skillGaps createdAt').lean();
        } else {
            // Fallback to the single latest active report
            reportQuery = interviewReportModel.findOne({
                $or: [{ user: userObjectId }, { user: userId.toString() }]
            }).sort({ createdAt: -1 }).select('developerTitle jobDescription matchScore skillGaps createdAt').lean();
        }

        const [currentReport, userDoc] = await Promise.all([
            reportQuery,
            userModel.findById(userObjectId).select('name careerProfile').lean()
        ]);

        const careerProfile = userDoc?.careerProfile || {};
        const userName = userDoc?.name || 'Candidate';

        // Extract skill gaps only for THIS specific current report
        const reportSkillGaps = [];
        if (currentReport && Array.isArray(currentReport.skillGaps)) {
            currentReport.skillGaps.forEach(g => {
                if (g.skill && reportSkillGaps.length < 4) {
                    reportSkillGaps.push(g.skill);
                }
            });
        }

        const compactJd = extractCompactJdSummary(currentReport?.jobDescription || '');

        return {
            candidateName: userName,
            targetRole: careerProfile.targetRole || currentReport?.developerTitle || 'Software Developer',
            experienceLevel: careerProfile.experienceLevel || 'Mid-Level',
            targetCompanies: careerProfile.targetCompanies || ['Product Companies'],
            selfDescription: careerProfile.selfDescription || '',
            // Current report specifics
            currentJobTitle: currentReport?.developerTitle || null,
            currentJobDescription: compactJd || null,
            currentMatchScore: currentReport?.matchScore || null,
            currentSkillGaps: reportSkillGaps
        };
    } catch (err) {
        console.error('[Context Assembler] Profile & Current Report fetch error:', err.message);
        return null;
    }
}

/**
 * Assembles a token-efficient system context prompt containing ONLY:
 * 1. Current Report's Job Description & Target Role (Most important!)
 * 2. Candidate's core bio & self-description
 * (Zero multi-report bloat)
 */
async function assembleContext(userId, reportId = null) {
    const [recentHistory, profile] = await Promise.all([
        getRecentChatHistory(userId),
        getCandidateMemoryProfile(userId, reportId)
    ]);

    let candidateContextSnippet = '';
    if (profile) {
        let currentJobSection = '';
        if (profile.currentJobDescription || profile.currentJobTitle) {
            currentJobSection = `
[Current Target Job & Company Context]
- Target Role: ${profile.currentJobTitle || profile.targetRole}
${profile.currentJobDescription ? `- Job Description / Key Requirements: "${profile.currentJobDescription}"\n` : ''}${profile.currentMatchScore ? `- Current Role Readiness Score: ${profile.currentMatchScore}%\n` : ''}${profile.currentSkillGaps.length > 0 ? `- Skill Gaps for this Target Job: ${profile.currentSkillGaps.join(', ')}\n` : ''}`;
        }

        const candidateBioSection = `
[Candidate Profile Information]
- Candidate Name: ${profile.candidateName}
- Target Career Focus: ${profile.targetRole} (${profile.experienceLevel})
${profile.selfDescription ? `- Candidate Self-Description / Pitch: "${profile.selfDescription}"\n` : ''}`;

        candidateContextSnippet = `${currentJobSection}${candidateBioSection}`.trim();
    }

    return {
        candidateContextSnippet,
        recentHistory,
        profile
    };
}

module.exports = {
    assembleContext,
    getRecentChatHistory,
    appendChatTurn,
    getCandidateMemoryProfile,
    extractCompactJdSummary
};
