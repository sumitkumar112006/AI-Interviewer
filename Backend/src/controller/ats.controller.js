/**
 * @file ats.controller.js
 * @module controller/ats.controller
 *
 * Dedicated ATS Match Score Controller.
 * Computes grounded 0-100 ATS scores for the Resume Editor and pipeline.
 */

'use strict';

const crypto = require('crypto');
const interviewReportModel = require('../models/interviewReport.model');
const { calculateAtsMatchScore } = require('../services/ats/atsEngine');
const { getCache, setCache } = require('../services/redis.service');

/**
 * Calculate ATS Match Score for the editor page.
 * Accepts:
 *  - params.interviewId (optional)
 *  - body.resumeHtml / body.resume (optional if interviewId provided)
 *  - body.jobDescription (optional if interviewId provided)
 */
async function calculateAtsScoreController(req, res) {
    try {
        const interviewId = req.params?.interviewId || req.body?.interviewId;
        let resumeContent = req.body?.resumeHtml || req.body?.resume || '';
        let jobDescription = req.body?.jobDescription || '';

        let report = null;

        // 1. If interviewId provided, load missing context from DB
        if (interviewId) {
            const userId = req.user?._id || req.user?.id;
            const query = { _id: interviewId };
            if (userId && !req.user?.isAdmin) {
                query.user = userId;
            }
            report = await interviewReportModel.findOne(query);

            if (!report) {
                return res.status(404).json({ message: 'Interview report not found.' });
            }

            if (!jobDescription) {
                jobDescription = report.jobDescription || '';
            }

            if (!resumeContent) {
                resumeContent = report.generatedResumeHtml || report.resume || '';
            }
        }

        if (!resumeContent || !jobDescription) {
            return res.status(400).json({
                message: 'Both resume content and job description are required to calculate ATS match score.'
            });
        }

        // 2. Redis SHA-256 Cache Check (Fast-path < 100ms)
        const resumeHash = crypto.createHash('sha256').update(String(resumeContent)).digest('hex');
        const jdHash = crypto.createHash('sha256').update(String(jobDescription)).digest('hex');
        const cacheKey = `ats_score:${resumeHash}:${jdHash}`;

        const cached = await getCache(cacheKey);
        if (cached && typeof cached.ats_score === 'number') {
            return res.status(200).json({
                success: true,
                cached: true,
                ...cached
            });
        }

        // 3. Compute score via grounded ATS Engine
        const result = await calculateAtsMatchScore({
            resume: resumeContent,
            jobDescription,
            skipEmbeddings: false
        });

        // 4. Save to Redis cache (7 days)
        await setCache(cacheKey, result, 604800);

        // 5. If linked to an interview report and the score changed, update DB matchScore
        if (report && typeof result.ats_score === 'number' && report.matchScore !== result.ats_score) {
            report.matchScore = result.ats_score;
            await report.save().catch(saveErr => {
                console.warn('[AtsController] DB sync notice:', saveErr.message);
            });
        }

        return res.status(200).json({
            success: true,
            cached: false,
            ats_score: result.ats_score,
            confidence: result.confidence,
            breakdown: result.breakdown
        });
    } catch (error) {
        console.error('[ATS Calculation Error]:', error);
        return res.status(500).json({
            message: 'Failed to calculate ATS score.',
            error: error.message
        });
    }
}

module.exports = {
    calculateAtsScoreController
};

