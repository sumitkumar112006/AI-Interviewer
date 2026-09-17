const mongoose = require('mongoose');
const { getRecentChatHistory, extractCompactJdSummary } = require('./contextAssembler');
const { parseResumeHtml, parseRoadmap, parseJobDescription } = require('./Chunker');
const { getOrEmbedChunks, getOrEmbedRoadmapChunks, getOrEmbedJdChunks, embedQuery } = require('./Embedder');
const interviewReportModel = require('../models/interviewReport.model');
const userModel = require('../models/user.model');

/**
 * Fast in-memory cosine similarity calculation between two float vectors.
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot   += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Selectively loads dynamic context from MongoDB and Redis based on the Classified Intent.
 * Features 3 targeted RAG pipelines:
 *   1. Resume RAG (full structure + semantic chunk highlights)
 *   2. Roadmap RAG (full 14-day milestones/tasks + semantic chunk highlights)
 *   3. Job Description RAG (full job specifications + semantic chunk highlights)
 * Bypasses MongoDB completely for General Tech & Platform queries (0 DB queries).
 * 
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.reportId]
 * @param {Object} params.intentData - Result from classifyIntent()
 * @param {string} [params.promptText] - User query string for embedding search
 * @param {string} [params.selectedText] - Selected editor text if any
 * @returns {Promise<Object>} { candidateContextSnippet, recentHistory, profile, dbCallsAvoided }
 */
async function loadDynamicContext({ userId, reportId = null, intentData, promptText = '', selectedText = '' }) {
    const historyLimit = typeof intentData?.history_turns_needed === 'number' 
        ? intentData.history_turns_needed 
        : 2;

    const contextFlags = intentData?.context || {};
    const contextKeys = intentData?.context_keys || [];

    const needsResume = contextFlags.resume ?? (
        contextKeys.some(k => k.startsWith('resume.') || k === 'resume') ||
        ['RESUME', 'RESUME_JD', 'RESUME_ROADMAP', 'ALL_THREE'].includes(intentData?.intent) ||
        Boolean(selectedText && selectedText.trim())
    );

    const needsJob = contextFlags.jd ?? (
        contextKeys.some(k => k.startsWith('job.') || k === 'job' || k === 'job_description') ||
        ['JOB_DESCRIPTION', 'RESUME_JD', 'ROADMAP_JD', 'ALL_THREE'].includes(intentData?.intent)
    );

    const needsRoadmap = contextFlags.roadmap ?? (
        contextKeys.some(k => k.startsWith('roadmap.') || k === 'roadmap') ||
        ['ROADMAP', 'ROADMAP_JD', 'RESUME_ROADMAP', 'ALL_THREE'].includes(intentData?.intent)
    );

    const needsUser = contextKeys.some(k => k.startsWith('user.') || k === 'skills' || k === 'projects');

    // 1. Zero DB Path (TECH_CONCEPT, PLATFORM_HELP, or any query where requires_context is false)
    if (!needsResume && !needsJob && !needsRoadmap && !needsUser && !intentData?.requires_context) {
        const recentHistory = historyLimit > 0 ? await getRecentChatHistory(userId, historyLimit) : [];
        return {
            candidateContextSnippet: '',
            recentHistory,
            profile: null,
            dbCallsAvoided: true
        };
    }

    try {
        const isDbConnected = mongoose.connection.readyState === 1;
        const userObjectId = (userId && mongoose.Types.ObjectId.isValid(userId)) ? new mongoose.Types.ObjectId(userId) : userId;

        // Build report query with tailored lean projection
        let reportPromise = Promise.resolve(null);
        if ((needsJob || needsRoadmap || needsResume) && userObjectId && isDbConnected) {
            let selectFields = 'developerTitle';
            if (needsJob) selectFields += ' jobDescription';
            if (needsRoadmap) selectFields += ' matchScore skillGaps preparationPlan completedTasks';
            if (needsResume) selectFields += ' generatedResumeHtml resume';

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
        const snippetParts = [];
        const reportIdStr = (reportDoc?._id || reportId || '').toString();
        const queryText = (promptText || selectedText || '').trim();

        let cachedQueryVec = null;
        const getSharedQueryVec = async () => {
            if (!cachedQueryVec && queryText) {
                cachedQueryVec = await embedQuery(queryText);
            }
            return cachedQueryVec;
        };

        // ── A. Job Description Context: Full Specification + Semantic Highlights ──
        if (needsJob && reportDoc && reportDoc.jobDescription) {
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

            profile.targetRole = reportDoc.developerTitle || 'Software Developer';
            profile.currentJobDescription = cleanJd.slice(0, 300);

            if (cleanJd) {
                snippetParts.push(`[Target Job Description & Role Specifications]:\n"""\nTarget Role: ${profile.targetRole}\n\n${cleanJd}\n"""`);
            }

            // Vector Search Highlights for JD
            try {
                const rawJdChunks = parseJobDescription(cleanJd, profile.targetRole);
                if (rawJdChunks.length > 0 && reportIdStr) {
                    const enrichedJd = await getOrEmbedJdChunks(reportIdStr, rawJdChunks);
                    const queryVec = await getSharedQueryVec();
                    if (queryVec && Array.isArray(enrichedJd) && enrichedJd.length > 0) {
                        const scoredJd = enrichedJd
                            .filter(c => c && Array.isArray(c.embedding))
                            .map(c => ({
                                chunk: c,
                                score: cosineSimilarity(queryVec, c.embedding)
                            }))
                            .sort((a, b) => b.score - a.score);

                        const topJdMatches = scoredJd.slice(0, 3);
                        if (topJdMatches.length > 0 && topJdMatches[0].score > 0.45) {
                            const jdLines = topJdMatches.map((m, idx) =>
                                `  [Highlight ${idx + 1} | ${m.chunk.type} (relevance: ${(m.score * 100).toFixed(1)}%)]:\n  "${m.chunk.text}"`
                            ).join('\n\n');
                            snippetParts.push(`[Relevant Job Description Semantic Highlights]:\n${jdLines}`);
                        }
                    }
                }
            } catch (err) {
                console.warn('[DynamicContextLoader] JD RAG vector retrieval fallback:', err.message);
            }
        }

        // ── B. Roadmap Context: Complete 14-Day Structure + Semantic Highlights ────
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

            snippetParts.push(`[14-Day Structured Preparation Roadmap (${completedCount}/${totalTasks} Tasks Completed — ${progressPercent}%)]:\n${roadmapLines}`);

            // Vector Search Highlights for Roadmap
            try {
                const rawRoadmapChunks = parseRoadmap(reportDoc.preparationPlan, reportDoc.completedTasks || []);
                if (rawRoadmapChunks.length > 0 && reportIdStr) {
                    const enrichedRoadmap = await getOrEmbedRoadmapChunks(reportIdStr, rawRoadmapChunks);
                    const queryVec = await getSharedQueryVec();
                    if (queryVec && Array.isArray(enrichedRoadmap) && enrichedRoadmap.length > 0) {
                        const scoredRoadmap = enrichedRoadmap
                            .filter(c => c && Array.isArray(c.embedding))
                            .map(c => ({
                                chunk: c,
                                score: cosineSimilarity(queryVec, c.embedding)
                            }))
                            .sort((a, b) => b.score - a.score);

                        const topRoadmapMatches = scoredRoadmap.slice(0, 3);
                        if (topRoadmapMatches.length > 0 && topRoadmapMatches[0].score > 0.45) {
                            const matchLines = topRoadmapMatches.map((m, idx) =>
                                `  [Highlight ${idx + 1} | ${m.chunk.type} (relevance: ${(m.score * 100).toFixed(1)}%)]:\n  "${m.chunk.text}"`
                            ).join('\n\n');
                            snippetParts.push(`[Relevant Roadmap Semantic Highlights]:\n${matchLines}`);
                        }
                    }
                }
            } catch (err) {
                console.warn('[DynamicContextLoader] Roadmap RAG vector retrieval fallback:', err.message);
            }
        }

        // ── C. Resume Context: Full Clean Document + Semantic Highlights ──────────
        if (needsResume && reportDoc) {
            const resumeContent = reportDoc.generatedResumeHtml || reportDoc.resume;
            if (resumeContent && typeof resumeContent === 'string' && resumeContent.trim()) {
                const cleanFullResume = resumeContent
                    .replace(/<h[1-6][^>]*>/gi, '\n### ')
                    .replace(/<\/h[1-6]>/gi, '\n')
                    .replace(/<li[^>]*>/gi, '\n• ')
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
                    snippetParts.push(`[Candidate's Active Resume Document Structure]:\n"""\n${cleanFullResume}\n"""`);
                }

                // Vector Search Highlights for Resume
                try {
                    const rawChunks = parseResumeHtml(resumeContent);
                    if (rawChunks.length > 0 && reportIdStr) {
                        const enrichedChunks = await getOrEmbedChunks(reportIdStr, rawChunks);
                        const queryVec = await getSharedQueryVec();
                        if (queryVec && Array.isArray(enrichedChunks) && enrichedChunks.length > 0) {
                            const scoredChunks = enrichedChunks
                                .filter(c => c && Array.isArray(c.embedding))
                                .map(c => ({
                                    chunk: c,
                                    score: cosineSimilarity(queryVec, c.embedding)
                                }))
                                .sort((a, b) => b.score - a.score);

                            const topMatches = scoredChunks.slice(0, 3);
                            if (topMatches.length > 0) {
                                const chunkLines = topMatches.map((m, idx) =>
                                    `  [Highlight ${idx + 1} | ${m.chunk.type} / ${m.chunk.section} (relevance: ${(m.score * 100).toFixed(1)}%)]:\n  "${m.chunk.text}"`
                                ).join('\n\n');
                                snippetParts.push(`[Relevant Resume Semantic Highlights]:\n${chunkLines}`);
                            }
                        }
                    }
                } catch (ragErr) {
                    console.warn('[DynamicContextLoader] Resume RAG vector retrieval fallback:', ragErr.message);
                }
            }
        }

        // ── D. User Profile Context ───────────────────────────────────────────────
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
