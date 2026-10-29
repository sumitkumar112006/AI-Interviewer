/**
 * @file jdParser.js
 * @module services/ats/parsers/jdParser
 *
 * Deterministic Job Description Parser & Taxonomy Classifier.
 * Extracts technical skills, responsibilities, experience tenure, and degree requirements.
 */

'use strict';

const { CANONICAL_ALIASES, TECH_CATALOG } = require('../config/aliases.config');

const CRITICAL_KEYWORDS = [
    /\b(must have|mandatory|strictly required|essential|minimum of|required)\b/i
];

const PREFERRED_KEYWORDS = [
    /\b(preferred|nice to have|plus|bonus|optional|good to have|desired)\b/i
];

/**
 * Infer the role archetype based on JD text.
 */
function inferArchetype(text = '') {
    const lower = text.toLowerCase();
    if (/\b(intern|internship|graduate|trainee|fresher|junior|entry[\s-]level)\b/i.test(lower)) {
        return 'INTERNSHIP_GRADUATE';
    }
    if (/\b(ai|ml|machine learning|deep learning|data scientist|nlp|computer vision|llm)\b/i.test(lower)) {
        return 'AI_ML_ENGINEER';
    }
    if (/\b(data engineer|etl|data pipeline|snowflake|spark|kafka|bigquery|hadoop)\b/i.test(lower)) {
        return 'DATA_ENGINEER';
    }
    return 'SOFTWARE_ENGINEER';
}

/**
 * Extract required years of experience.
 */
function extractRequiredYears(text = '') {
    const match = text.match(/(\d+)(?:\+?|\s*(?:to|-)\s*(\d+)?)\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i);
    if (match) {
        return parseInt(match[1], 10) || 0;
    }
    return 0;
}

/**
 * Extract required education level.
 */
function extractRequiredEducation(text = '') {
    const lower = text.toLowerCase();
    let level = 'ANY';
    let isMandatory = false;

    if (/\b(ph\.?d|doctorate)\b/i.test(lower)) {
        level = 'PHD';
    } else if (/\b(master'?s|m\.?tech|m\.?s|m\.?c\.?a)\b/i.test(lower)) {
        level = 'MASTER';
    } else if (/\b(bachelor'?s|b\.?tech|b\.?e|b\.?s|b\.?c\.?a|degree in computer science)\b/i.test(lower)) {
        level = 'BACHELOR';
    }

    if (/\b(degree required|must possess a degree|minimum bachelor'?s)\b/i.test(lower)) {
        isMandatory = true;
    }

    return { requiredLevel: level, isMandatory };
}

/**
 * Parses raw JD text into typed requirements with importance and criticality.
 *
 * @param {string} jdText
 * @returns {Object} Structured JD
 */
function parseJobDescription(jdText = '') {
    if (!jdText || typeof jdText !== 'string') {
        return {
            archetype: 'SOFTWARE_ENGINEER',
            requiredYearsExp: 0,
            educationRequirement: { requiredLevel: 'ANY', isMandatory: false },
            requirements: []
        };
    }

    const archetype = inferArchetype(jdText);
    const requiredYearsExp = extractRequiredYears(jdText);
    const educationRequirement = extractRequiredEducation(jdText);

    const lines = jdText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const requirements = [];
    const seenTech = new Set();
    let reqIndex = 1;

    // 1. Scan for Technical Skills across lines
    for (const line of lines) {
        const isCriticalLine = CRITICAL_KEYWORDS.some(rx => rx.test(line));
        const isPreferredLine = PREFERRED_KEYWORDS.some(rx => rx.test(line));

        for (const [category, skills] of Object.entries(TECH_CATALOG)) {
            for (const skill of skills) {
                // Word boundary check
                const escaped = skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
                const rx = new RegExp(`\\b${escaped}\\b`, 'i');

                if (rx.test(line) && !seenTech.has(skill)) {
                    seenTech.add(skill);
                    const isMandatory = isCriticalLine || (!isPreferredLine && requiredYearsExp > 0);
                    requirements.push({
                        id: `req_tech_${reqIndex++}`,
                        name: skill,
                        category,
                        isMandatory,
                        criticality: isMandatory ? (isCriticalLine ? 'CRITICAL' : 'HIGH') : 'MEDIUM',
                        aliases: [CANONICAL_ALIASES[skill.toLowerCase()]].filter(Boolean)
                    });
                }
            }
        }

        // 2. Scan for Responsibility statements (e.g. lines with action verbs like design, build, maintain, lead)
        if (
            /^[•\-\*\d\.]+\s*(?:design|build|develop|architect|lead|maintain|scale|collaborate|optimize|implement)\b/i.test(line) ||
            /^(?:responsibilities|duties|what you will do)/i.test(line)
        ) {
            const cleanResp = line.replace(/^[•\-\*\d\.]+\s*/, '').trim();
            if (cleanResp.length > 20 && cleanResp.length < 200) {
                requirements.push({
                    id: `req_resp_${reqIndex++}`,
                    name: cleanResp,
                    category: 'RESPONSIBILITY',
                    isMandatory: isCriticalLine,
                    criticality: isCriticalLine ? 'HIGH' : 'MEDIUM',
                    aliases: []
                });
            }
        }
    }

    return {
        archetype,
        requiredYearsExp,
        educationRequirement,
        requirements
    };
}

module.exports = {
    parseJobDescription,
    inferArchetype,
    extractRequiredYears,
    extractRequiredEducation
};
