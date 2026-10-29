/**
 * @file resumeParser.js
 * @module services/ats/parsers/resumeParser
 *
 * Deterministic Resume Parser for plain text and TipTap editor HTML.
 * Preserves evidence context tiers and calculates ATS format compatibility.
 */

'use strict';

const { TECH_CATALOG, CANONICAL_ALIASES } = require('../config/aliases.config');

const SECTION_PATTERNS = {
    PROFESSIONAL_EXP: /(?:work\s+experience|professional\s+experience|experience|employment\s+history|career)/i,
    INTERNSHIP: /(?:internships?|intern\s+experience)/i,
    PROJECT: /(?:projects?|personal\s+projects?|academic\s+projects?|side\s+projects?)/i,
    EDUCATION: /(?:education|academic\s+background|academics|qualifications)/i,
    CERTIFICATION: /(?:certifications?|certificates?|licenses?)/i,
    SKILL_LIST: /(?:technical\s+skills?|skills?|core\s+competencies|technologies|tech\s+stack)/i,
    SUMMARY: /(?:summary|professional\s+summary|profile|about\s+me|objective)/i
};

/**
 * Strip HTML tags and collapse whitespace.
 */
function htmlToPlainText(html = '') {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<\/p>|<\/li>|<\/h[1-6]>|<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim();
}

/**
 * Infer education level from resume text.
 */
function extractHighestDegree(text = '') {
    const lower = text.toLowerCase();
    if (/\b(ph\.?d|doctorate)\b/i.test(lower)) return 'PHD';
    if (/\b(master'?s|m\.?tech|m\.?s|m\.?c\.?a)\b/i.test(lower)) return 'MASTER';
    if (/\b(bachelor'?s|b\.?tech|b\.?e|b\.?s|b\.?c\.?a|undergraduate)\b/i.test(lower)) return 'BACHELOR';
    return 'DIPLOMA';
}

/**
 * Infer candidate seniority based on titles and years.
 */
function inferSeniority(text = '', years = 0) {
    const lower = text.toLowerCase();
    if (/\b(staff|principal|director|vp|head of)\b/i.test(lower) || years >= 9) return 'STAFF';
    if (/\b(lead|architect|manager)\b/i.test(lower) || years >= 7) return 'LEAD';
    if (/\b(senior|sr\.)\b/i.test(lower) || years >= 4) return 'SENIOR';
    if (/\b(junior|jr\.|associate)\b/i.test(lower) || years <= 1) return 'JUNIOR';
    if (/\b(intern|internship|student|fresher)\b/i.test(lower) && years === 0) return 'INTERN';
    return 'MID';
}

/**
 * Infer total years of experience from date ranges in the resume.
 */
function estimateYearsOfExperience(text = '') {
    const yearMatches = text.match(/\b(20\d\d|19\d\d)\b/g);
    if (!yearMatches || yearMatches.length < 2) return 1;

    const years = yearMatches.map(y => parseInt(y, 10)).filter(y => y >= 1990 && y <= new Date().getFullYear());
    if (years.length < 2) return 1;

    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const span = maxYear - minYear;

    return Math.max(0, Math.min(25, span));
}

/**
 * Computes ATS format compatibility signal (0.0 to 1.0).
 */
function evaluateAtsCompatibility(rawText = '', rawHtml = '') {
    let score = 1.0;

    // 1. Minimum content check
    if (rawText.length < 200) {
        score -= 0.35;
    }

    // 2. Standard section headers check
    let standardSectionsFound = 0;
    for (const pattern of Object.values(SECTION_PATTERNS)) {
        if (pattern.test(rawText)) standardSectionsFound++;
    }
    if (standardSectionsFound < 3) {
        score -= 0.15;
    }

    // 3. Excessive table layout / nested div risk
    if (rawHtml) {
        const tableCount = (rawHtml.match(/<table/gi) || []).length;
        if (tableCount > 2) {
            score -= 0.10; // complex tables can disrupt parsing in some ATS parsers
        }
    }

    // 4. Contact info presence
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(rawText);
    const hasPhone = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(rawText);
    if (!hasEmail && !hasPhone) {
        score -= 0.10;
    }

    return Math.max(0.50, Math.min(1.0, Number(score.toFixed(2))));
}

/**
 * Parses resume text/HTML into structured evidence with context tiers.
 *
 * @param {string} resumeInput - Raw plain text or HTML
 * @returns {Object} Structured resume data
 */
function parseResume(resumeInput = '') {
    const isHtml = /<[a-z][\s\S]*>/i.test(resumeInput);
    const plainText = isHtml ? htmlToPlainText(resumeInput) : resumeInput;
    const rawHtml = isHtml ? resumeInput : '';

    const lines = plainText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const evidenceList = [];
    const projects = [];

    let currentSection = 'SUMMARY';
    let currentTier = 'SUMMARY';

    for (const line of lines) {
        // Detect section changes
        let detectedTier = null;
        for (const [tier, rx] of Object.entries(SECTION_PATTERNS)) {
            // Check if line looks like a header (short, matches section keyword)
            if (line.length < 40 && rx.test(line)) {
                detectedTier = tier;
                break;
            }
        }

        if (detectedTier) {
            currentSection = detectedTier;
            currentTier = detectedTier;
            continue;
        }

        // Project tracking
        if (currentTier === 'PROJECT' && line.length > 5 && line.length < 80 && !line.startsWith('•')) {
            projects.push(line);
        }

        // Tokenize potential skills / tokens from bullet points or skill lines
        // e.g. "React, Node.js, TypeScript, PostgreSQL, Docker"
        const tokens = line.split(/[,|•·/]+/).map(t => t.trim().replace(/[.,;:()]+$/, '')).filter(t => t.length >= 2 && t.length <= 35);
        for (const token of tokens) {
            // Filter common stopwords
            if (/^(and|with|the|using|in|for|of|a|an|to|on|at|by)$/i.test(token)) continue;

            evidenceList.push({
                name: token,
                rawText: line,
                section: currentSection,
                contextTier: currentTier
            });
        }

        // Also scan line for known technologies from TECH_CATALOG embedded in natural prose
        for (const skills of Object.values(TECH_CATALOG)) {
            for (const skill of skills) {
                const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
                const rx = new RegExp(`(?:^|[\\s,.;:()/"'|•·-])${escaped}(?:$|[\\s,.;:()/"'|•·-])`, 'i');
                if (rx.test(line)) {
                    evidenceList.push({
                        name: skill,
                        rawText: line,
                        section: currentSection,
                        contextTier: currentTier
                    });
                }
            }
        }
    }

    const totalYearsExp = estimateYearsOfExperience(plainText);
    const highestDegree = extractHighestDegree(plainText);
    const seniorityLevel = inferSeniority(plainText, totalYearsExp);
    const atsFormattingScore = evaluateAtsCompatibility(plainText, rawHtml);

    return {
        plainText,
        evidenceList,
        totalYearsExp,
        education: { highestDegree },
        seniorityLevel,
        projects,
        atsFormattingScore
    };
}

module.exports = {
    parseResume,
    htmlToPlainText,
    evaluateAtsCompatibility,
    estimateYearsOfExperience
};
