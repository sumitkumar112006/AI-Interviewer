/**
 * @file index.js
 * @module services/ats
 *
 * Barrel export for ATS Engine, Parsers, Matchers, and Improvement Extractor.
 */

'use strict';

const {
    calculateAtsMatchScore,
    computeExperienceScore,
    computeEducationScore,
    computeSeniorityScore,
    computeProjectScore
} = require('./atsEngine');

const {
    extractATSImprovements,
    categorizeSkill,
    suggestTargetSection,
    analyzeMetricDeficiencies
} = require('./atsImprovementExtractor');

const { parseJobDescription } = require('./parsers/jdParser');
const { parseResume, htmlToPlainText } = require('./parsers/resumeParser');

module.exports = {
    calculateAtsMatchScore,
    computeExperienceScore,
    computeEducationScore,
    computeSeniorityScore,
    computeProjectScore,
    extractATSImprovements,
    categorizeSkill,
    suggestTargetSection,
    analyzeMetricDeficiencies,
    parseJobDescription,
    parseResume,
    htmlToPlainText
};

