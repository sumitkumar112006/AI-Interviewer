/**
 * @file atsEngine.js
 * @module services/ats/atsEngine
 *
 * The Core ATS Score Calculator Engine.
 * Implements the hybrid, grounded, anti-double-counting scoring algorithm.
 */

'use strict';

const { WEIGHT_PROFILES } = require('./config/weights.config');
const { TECH_CATALOG } = require('./config/aliases.config');
const { parseJobDescription } = require('./parsers/jdParser');
const { parseResume } = require('./parsers/resumeParser');
const { matchSingleRequirement } = require('./matchers/requirementMatcher');
const { calculateControlledPenalty } = require('./scoring/controlledPenalty');
const { embedTextWithCache, embedBatch } = require('./matchers/embeddingService');

/**
 * Calculates candidate experience score based on required vs demonstrated tenure.
 */
function computeExperienceScore(candidateYears = 0, requiredYears = 0, archetype = 'SOFTWARE_ENGINEER') {
    if (archetype === 'INTERNSHIP_GRADUATE' || !requiredYears || requiredYears === 0) {
        return 1.0;
    }
    const ratio = candidateYears / requiredYears;
    if (ratio >= 1.0) return 1.0;
    if (ratio >= 0.75) return 0.85;
    if (ratio >= 0.50) return 0.60;
    if (ratio >= 0.25) return 0.35;
    return Math.max(0.15, ratio);
}

/**
 * Calculates education score based on required level.
 */
function computeEducationScore(resumeEdu = {}, jdEdu = {}) {
    if (!jdEdu || !jdEdu.requiredLevel || jdEdu.requiredLevel === 'ANY') {
        return 1.0;
    }
    const levels = { DIPLOMA: 1, BACHELOR: 2, MASTER: 3, PHD: 4 };
    const candidateRank = levels[resumeEdu.highestDegree] || 1;
    const requiredRank = levels[jdEdu.requiredLevel] || 2;

    if (candidateRank >= requiredRank) return 1.0;
    return Number(((candidateRank / requiredRank) * 0.75).toFixed(2));
}

/**
 * Calculates candidate seniority fit.
 */
function computeSeniorityScore(candidateSeniority = 'MID', jdArchetype = 'SOFTWARE_ENGINEER') {
    if (jdArchetype === 'INTERNSHIP_GRADUATE') return 1.0;
    const ranks = { INTERN: 1, JUNIOR: 2, MID: 3, SENIOR: 4, LEAD: 5, STAFF: 6 };
    const cRank = ranks[candidateSeniority] || 3;
    return cRank >= 2 ? 1.0 : 0.70;
}

/**
 * Calculates project relevance based on matched technologies.
 */
function computeProjectScore(projects = [], matches = []) {
    if (!projects || projects.length === 0) return 0.40;
    const matchedCount = matches.filter(m => m.score > 0 && m.matchedVia !== 'NONE').length;
    return Math.min(1.0, Number((0.50 + (matchedCount * 0.05)).toFixed(2)));
}

/**
 * Main Engine Entry Point: Compute ATS Match Score (0–100)
 *
 * @param {Object} params
 * @param {string} params.resume - Resume plain text or TipTap HTML
 * @param {string} params.jobDescription - Job description text
 * @param {boolean} [params.skipEmbeddings=false] - If true, evaluates deterministically only
 * @returns {Promise<Object>} { ats_score: number, confidence: number, breakdown: Object }
 */
async function calculateAtsMatchScore({ resume = '', jobDescription = '', skipEmbeddings = false }) {
    // 1. Structured Parsing
    const parsedJD = parseJobDescription(jobDescription);
    const parsedResume = parseResume(resume);

    // 2. Select Adaptive Weight Profile
    const profileKey = parsedJD.archetype || 'SOFTWARE_ENGINEER';
    const weights = WEIGHT_PROFILES[profileKey] || WEIGHT_PROFILES.SOFTWARE_ENGINEER;

    // 3. Optional Semantic Embedding Preparation
    let reqEmbeddings = new Map();
    let evidenceVectors = [];

    if (!skipEmbeddings && parsedJD.requirements.length > 0) {
        try {
            // Embed JD requirements (only uncached ones hit the API)
            for (const req of parsedJD.requirements) {
                const vec = await embedTextWithCache(req.name);
                if (vec) reqEmbeddings.set(req.id, vec);
            }

            // Embed unique candidate evidence items
            const uniqueTokens = Array.from(new Set(parsedResume.evidenceList.map(e => e.name.toLowerCase())))
                .slice(0, 30) // Bound to top candidate items for latency safety
                .map(name => {
                    const ev = parsedResume.evidenceList.find(e => e.name.toLowerCase() === name);
                    return { name: ev.name, text: `${ev.section}: ${ev.name}`, contextTier: ev.contextTier };
                });

            evidenceVectors = await embedBatch(uniqueTokens);
        } catch (embErr) {
            console.warn('[AtsEngine] Embedding step fallback to deterministic:', embErr.message);
        }
    }

    // 4. Match Every Requirement Individually
    const evaluationResults = [];
    const mandatoryMatches = [];

    for (const req of parsedJD.requirements) {
        const reqVector = reqEmbeddings.get(req.id) || null;
        const match = matchSingleRequirement(
            req,
            parsedResume.evidenceList,
            reqVector,
            evidenceVectors
        );

        match.category = req.category;
        match.isMandatory = req.isMandatory;
        match.criticality = req.criticality;

        evaluationResults.push(match);

        if (req.isMandatory) {
            mandatoryMatches.push(match);
        }
    }

    // 5. Aggregate Category Scores
    const getAvgScore = (categoryFilter) => {
        const items = evaluationResults.filter(categoryFilter);
        if (items.length === 0) return 1.0;
        const sum = items.reduce((acc, curr) => acc + curr.score, 0);
        return sum / items.length;
    };

    const techCategories = Object.keys(TECH_CATALOG);
    const technicalSkillsScore = getAvgScore(r => techCategories.includes(r.category));
    const requiredQualsScore = getAvgScore(r => r.isMandatory);
    const responsibilitiesScore = getAvgScore(r => r.category === 'RESPONSIBILITY');
    const domainScore = getAvgScore(r => r.category === 'DOMAIN');
    const educationScore = computeEducationScore(parsedResume.education, parsedJD.educationRequirement);
    const experienceScore = computeExperienceScore(parsedResume.totalYearsExp, parsedJD.requiredYearsExp, parsedJD.archetype);
    const projectsScore = computeProjectScore(parsedResume.projects, evaluationResults);
    const seniorityScore = computeSeniorityScore(parsedResume.seniorityLevel, parsedJD.archetype);
    const atsCompatibilityScore = parsedResume.atsFormattingScore || 0.95;

    // 6. Compute Raw Weighted Score (0 to 100)
    let rawScore = 0;
    rawScore += technicalSkillsScore * (weights.technicalSkills || 0);
    rawScore += requiredQualsScore * (weights.requiredQualifications || 0);
    rawScore += experienceScore * (weights.experience || 0);
    rawScore += responsibilitiesScore * (weights.responsibilities || 0);
    rawScore += projectsScore * (weights.projects || 0);
    rawScore += educationScore * (weights.education || 0);
    rawScore += domainScore * (weights.domain || 0);
    rawScore += seniorityScore * (weights.seniority || 0);
    rawScore += atsCompatibilityScore * (weights.atsCompatibility || 0);

    const scaledRaw = rawScore * 100;

    // 7. Controlled Mandatory Penalty
    const penaltyFactor = calculateControlledPenalty(mandatoryMatches);
    const finalCalculated = scaledRaw * (1.0 - penaltyFactor);

    // 8. Final Clamping & Integer Conversion
    const ats_score = Math.max(0, Math.min(100, Math.round(finalCalculated)));

    // 9. Aggregate Confidence
    const avgConfidence = evaluationResults.length > 0
        ? evaluationResults.reduce((acc, curr) => acc + curr.matchConfidence, 0) / evaluationResults.length
        : 1.0;

    const missingTech = evaluationResults.filter(r => techCategories.includes(r.category) && r.score === 0).map(r => r.requirementName);
    const matchedTech = evaluationResults.filter(r => techCategories.includes(r.category) && r.score > 0).map(r => r.requirementName);

    const missingOther = evaluationResults.filter(r => !techCategories.includes(r.category) && r.score === 0).map(r => r.requirementName);
    const matchedOther = evaluationResults.filter(r => !techCategories.includes(r.category) && r.score > 0).map(r => r.requirementName);

    return {
        ats_score,
        overallScore: ats_score, // backward-compatible alias
        confidence: Number(avgConfidence.toFixed(2)),
        // Internal explainability breakdown
        breakdown: {
            archetype: parsedJD.archetype,
            rawScore: Math.round(scaledRaw),
            penaltyFactor: Number(penaltyFactor.toFixed(3)),
            categories: {
                technicalSkills: Math.round(technicalSkillsScore * 100),
                requiredQualifications: Math.round(requiredQualsScore * 100),
                responsibilities: Math.round(responsibilitiesScore * 100),
                experience: Math.round(experienceScore * 100),
                education: Math.round(educationScore * 100),
                projects: Math.round(projectsScore * 100),
                atsCompatibility: Math.round(atsCompatibilityScore * 100)
            },
            skillsMatch: {
                missing: missingTech,
                matched: matchedTech
            },
            keywordMatch: {
                missing: missingOther,
                matched: matchedOther
            },
            totalRequirements: evaluationResults.length,
            matchedRequirements: evaluationResults.filter(r => r.score > 0).length
        }
    };
}

module.exports = {
    calculateAtsMatchScore,
    computeExperienceScore,
    computeEducationScore,
    computeSeniorityScore,
    computeProjectScore
};

