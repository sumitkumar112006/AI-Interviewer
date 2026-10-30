/**
 * @file weights.config.js
 * @module services/ats/config/weights.config
 *
 * Configurable Adaptive Weight Profiles per role archetype.
 * NOTE: Semantic similarity is purely a matching mechanism, NOT an independent weight bucket.
 * All weights in each profile strictly sum to 1.00 (100%).
 */

'use strict';

const WEIGHT_PROFILES = {
    // Standard Backend / Frontend / Fullstack / Mobile SWE
    SOFTWARE_ENGINEER: {
        technicalSkills: 0.30,
        requiredQualifications: 0.20,
        experience: 0.15,
        responsibilities: 0.15,
        projects: 0.08,
        education: 0.05,
        domain: 0.03,
        seniority: 0.02,
        atsCompatibility: 0.02
    },

    // Machine Learning / AI / Data Science
    AI_ML_ENGINEER: {
        technicalSkills: 0.30,
        requiredQualifications: 0.20,
        responsibilities: 0.15,
        experience: 0.12,
        projects: 0.10,
        education: 0.08,
        domain: 0.03,
        seniority: 0.02,
        atsCompatibility: 0.02
    },

    // Data Engineering / Big Data / Pipeline Specialist
    DATA_ENGINEER: {
        technicalSkills: 0.30,
        requiredQualifications: 0.20,
        responsibilities: 0.15,
        experience: 0.14,
        projects: 0.09,
        education: 0.05,
        domain: 0.03,
        seniority: 0.02,
        atsCompatibility: 0.02
    },

    // 📊 Data & Business Analytics
    DATA_ANALYST: {
        technicalSkills: 0.28,
        requiredQualifications: 0.20,
        responsibilities: 0.18,
        experience: 0.14,
        projects: 0.10,
        education: 0.04,
        domain: 0.03,
        seniority: 0.01,
        atsCompatibility: 0.02
    },

    // 🎯 Product & Project Management
    PRODUCT_MANAGER: {
        technicalSkills: 0.18,
        requiredQualifications: 0.20,
        responsibilities: 0.25,
        experience: 0.18,
        projects: 0.08,
        domain: 0.05,
        education: 0.03,
        seniority: 0.01,
        atsCompatibility: 0.02
    },

    // 🎨 UI / UX & Product Design
    UI_UX_DESIGNER: {
        technicalSkills: 0.25,
        projects: 0.25,
        responsibilities: 0.18,
        requiredQualifications: 0.15,
        experience: 0.10,
        domain: 0.03,
        education: 0.02,
        seniority: 0.00,
        atsCompatibility: 0.02
    },

    // 📈 Digital Marketing, Growth & SEO
    MARKETING: {
        technicalSkills: 0.22,
        responsibilities: 0.25,
        requiredQualifications: 0.20,
        experience: 0.18,
        projects: 0.07,
        domain: 0.04,
        education: 0.02,
        seniority: 0.00,
        atsCompatibility: 0.02
    },

    // 💼 General Business, Sales, HR & Operations
    BUSINESS_OPERATIONS: {
        technicalSkills: 0.18,
        responsibilities: 0.28,
        experience: 0.20,
        requiredQualifications: 0.18,
        domain: 0.06,
        projects: 0.04,
        education: 0.03,
        seniority: 0.01,
        atsCompatibility: 0.02
    },

    // Student / Intern / Fresh Graduate (No free 100% experience points!)
    INTERNSHIP_GRADUATE: {
        technicalSkills: 0.30,
        projects: 0.30,
        education: 0.20,
        requiredQualifications: 0.10,
        responsibilities: 0.05,
        experience: 0.00, // Experience has 0 weight; judged on projects/education/skills
        domain: 0.02,
        seniority: 0.00,
        atsCompatibility: 0.03
    }
};

module.exports = { WEIGHT_PROFILES };
