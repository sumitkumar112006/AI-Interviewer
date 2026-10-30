/**
 * @file atsImprovementExtractor.js
 * @module services/ats/atsImprovementExtractor
 *
 * ATS Improvement & Difference Panel Extractor.
 * Analyzes Resume vs. Job Description using the ATS calculation engine to identify:
 * 1. "New Added" (+N)  - Newly added skills/keywords in the current resume version.
 * 2. "Retained" (N)    - Skills/keywords carried over and matching the target JD.
 * 3. "Not in Resume" (N)- Critical skills/keywords present in JD but missing from the resume.
 * 4. Section-by-Section actionable improvement recommendations with estimated score gains.
 */

'use strict';

const { calculateAtsMatchScore } = require('./atsEngine');
const { parseJobDescription } = require('./parsers/jdParser');
const { parseResume, htmlToPlainText } = require('./parsers/resumeParser');
const { TECH_CATALOG, CANONICAL_ALIASES } = require('./config/aliases.config');
const { compareResumeSkillsDiff, extractSkillsFromResumeHtml, extractSkillsFromRawResumeText } = require('../skills.service');

/**
 * Categorize a skill or keyword into a user-friendly domain category.
 */
function categorizeSkill(skillName = '') {
    const lower = skillName.toLowerCase().trim();
    if (/\b(python|java|c\+\+|c#|javascript|typescript|golang|ruby|rust|php|swift|kotlin|scala|sql|html|css)\b/i.test(lower)) {
        return 'LANGUAGES';
    }
    if (/\b(react|angular|vue|next\.?js|node\.?js|express|fastapi|django|spring|flask|rails)\b/i.test(lower)) {
        return 'FRAMEWORKS';
    }
    if (/\b(aws|azure|gcp|docker|kubernetes|ci\/cd|terraform|cloudformation|lambda)\b/i.test(lower)) {
        return 'CLOUD_DEVOPS';
    }
    if (/\b(postgres|mongodb|redis|mysql|dynamodb|cassandra|elasticsearch)\b/i.test(lower)) {
        return 'DATABASES';
    }
    if (/\b(machine learning|ai|ml|deep learning|llm|nlp|computer vision|tensorflow|pytorch)\b/i.test(lower)) {
        return 'AI_ML';
    }
    if (/\b(testing|automation|selenium|jest|cypress|pytest|qa)\b/i.test(lower)) {
        return 'TESTING_QA';
    }
    if (/\b(agile|scrum|jira|git|github|leadership|management|mentorship)\b/i.test(lower)) {
        return 'TOOLS_METHODOLOGIES';
    }
    for (const [catName, skillList] of Object.entries(TECH_CATALOG)) {
        if (Array.isArray(skillList) && skillList.some(s => s.toLowerCase() === lower)) {
            if (catName === 'PROGRAMMING_LANGUAGE') return 'LANGUAGES';
            if (catName === 'FRAMEWORK') return 'FRAMEWORKS';
            if (catName === 'DATABASE') return 'DATABASES';
            if (catName === 'CLOUD' || catName === 'DEVOPS') return 'CLOUD_DEVOPS';
            return catName;
        }
    }
    return 'TECHNICAL_SKILLS';
}

/**
 * Suggests the best resume section where a missing item should be placed.
 */
function suggestTargetSection(category = '', itemName = '') {
    const cat = category.toUpperCase();
    if (cat.includes('FRAMEWORK') || cat.includes('LANGUAGE') || cat.includes('DATABASE') || cat.includes('CLOUD') || cat.includes('AI_ML')) {
        return 'SKILLS';
    }
    if (cat.includes('RESPONSIBILITY') || cat.includes('EXPERIENCE') || cat.includes('TESTING')) {
        return 'EXPERIENCE';
    }
    if (cat.includes('PROJECT') || itemName.toLowerCase().includes('demo') || itemName.toLowerCase().includes('platform')) {
        return 'PROJECTS';
    }
    return 'SKILLS';
}

/**
 * Extracts quantifiable metric deficiency in experience bullet points.
 */
function analyzeMetricDeficiencies(plainText = '') {
    const lines = plainText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 25);
    const bulletsWithoutMetrics = [];

    const metricRegex = /\b(\d+[%kKmMbB]?|\$\d+|\d+\+|\d+x|sub-millisecond|zero-downtime)\b/i;

    for (const line of lines) {
        if (/^(?:[-*•]|\d+\.)/.test(line) || /^(?:engineered|developed|implemented|designed|built|architected|led|managed|optimized)/i.test(line)) {
            if (!metricRegex.test(line) && line.length > 40) {
                bulletsWithoutMetrics.push(line);
            }
        }
    }

    return bulletsWithoutMetrics.slice(0, 4);
}

/**
 * Core Extractor Function:
 * Extracts ATS improvements, diff tracking (New, Retained, Missing), and actionable advice.
 *
 * @param {Object} params
 * @param {string} params.resume - Current resume text or HTML
 * @param {string} params.jobDescription - Target job description text
 * @param {string} [params.originalResume=null] - Baseline original resume text (if comparing versions)
 * @param {Object} [params.options={}] - Optional tuning parameters
 * @returns {Promise<Object>} Structured ATS Improvement Report
 */
async function extractATSImprovements({
    resume = '',
    jobDescription = '',
    originalResume = null,
    options = {}
}) {
    if (!resume && !jobDescription) {
        throw new Error('Both resume and jobDescription are required to extract ATS improvements.');
    }

    const currentResumeText = typeof resume === 'string' ? resume : '';
    const jdText = typeof jobDescription === 'string' ? jobDescription : '';
    const origResumeText = typeof originalResume === 'string' ? originalResume : '';

    // 1. Run ATS Scoring Engine
    const atsResult = await calculateAtsMatchScore({
        resume: currentResumeText,
        jobDescription: jdText,
        skipEmbeddings: options.skipEmbeddings !== false
    });

    const currentScore = atsResult.ats_score || atsResult.overallScore || 0;

    // 2. Parse JD & Resume Structure
    const parsedJD = parseJobDescription(jdText);
    const parsedResume = parseResume(currentResumeText);
    const plainResumeText = htmlToPlainText(currentResumeText);

    // 3. Compare Skills Diff (Baseline vs Current)
    const skillsDiff = compareResumeSkillsDiff({
        originalResumeText: origResumeText || plainResumeText,
        currentResumeHtml: /<[a-z][\s\S]*>/i.test(currentResumeText) ? currentResumeText : '',
        currentResumeSkills: parsedResume.evidenceList ? parsedResume.evidenceList.map(e => e.name) : []
    });

    // 4. Extract Retained Items (Blue)
    // Items present in the current resume that match the Job Description requirements
    const retainedSet = new Set();
    const retainedList = [];

    const matchedTech = atsResult.breakdown?.skillsMatch?.matched || [];
    const matchedOther = atsResult.breakdown?.keywordMatch?.matched || [];
    const allMatched = [...new Set([...matchedTech, ...matchedOther])];

    for (const item of allMatched) {
        const cleanName = item.trim();
        const lower = cleanName.toLowerCase();
        if (!lower || retainedSet.has(lower)) continue;
        retainedSet.add(lower);

        const category = categorizeSkill(cleanName);
        retainedList.push({
            name: cleanName,
            category,
            tag: 'Retained',
            color: 'blue',
            colorHex: '#3b82f6',
            status: 'retained',
            matchConfidence: 0.95
        });
    }

    // 5. Extract Not in Resume Items (Red)
    // Items present in Job Description that are currently missing from the resume
    const missingSet = new Set();
    const notInResumeList = [];

    const missingTech = atsResult.breakdown?.skillsMatch?.missing || [];
    const missingOther = atsResult.breakdown?.keywordMatch?.missing || [];

    // Prioritize technical skills and requirements over generic prose stopwords
    const candidateMissing = [
        ...missingTech.map(name => ({ name, isTech: true })),
        ...missingOther.map(name => ({ name, isTech: false }))
    ];

    for (const { name, isTech } of candidateMissing) {
        const cleanName = name.trim();
        const lower = cleanName.toLowerCase();
        if (!lower || lower.length < 2 || missingSet.has(lower) || retainedSet.has(lower)) continue;
        missingSet.add(lower);

        const category = categorizeSkill(cleanName);
        const isMandatory = isTech || Boolean(parsedJD.requirements?.find(r => r.name.toLowerCase() === lower)?.isMandatory);
        const criticality = isMandatory ? 'CRITICAL' : isTech ? 'HIGH' : 'MEDIUM';
        const impactScore = isMandatory ? 6 : isTech ? 4 : 2;
        const suggestedSection = suggestTargetSection(category, cleanName);

        notInResumeList.push({
            name: cleanName,
            category,
            criticality,
            isMandatory,
            impactScore,
            suggestedSection,
            recommendation: `Add '${cleanName}' to ${suggestedSection} section to fulfill JD criteria.`,
            tag: 'Not in Resume',
            color: 'red',
            colorHex: '#ef4444',
            status: 'missing'
        });
    }

    // Sort missing items by criticality (CRITICAL -> HIGH -> MEDIUM)
    notInResumeList.sort((a, b) => b.impactScore - a.impactScore);

    // 6. Extract New Added Items (Green)
    // Skills present in current resume that were newly added vs. original baseline, or added to meet JD
    const newAddedList = [];
    if (skillsDiff && skillsDiff.currentSkills && Array.isArray(skillsDiff.currentSkills.newSkills)) {
        for (const skillObj of skillsDiff.currentSkills.newSkills) {
            const isMatch = retainedSet.has(skillObj.name.toLowerCase());
            newAddedList.push({
                name: skillObj.name,
                category: categorizeSkill(skillObj.name),
                tag: 'New Added',
                color: 'green',
                colorHex: '#10b981',
                status: 'new_added',
                isJdMatch: isMatch
            });
        }
    }

    // If no original baseline was passed, extract newly added highlights from current resume skills
    if (newAddedList.length === 0) {
        const topCurrent = retainedList.slice(0, 10);
        for (const item of topCurrent) {
            newAddedList.push({
                ...item,
                tag: 'New Added',
                color: 'green',
                colorHex: '#10b981',
                status: 'new_added',
                isJdMatch: true
            });
        }
    }

    // 7. Calculate Potential ATS Score if critical gaps are added
    const criticalMissingCount = notInResumeList.filter(i => i.criticality === 'CRITICAL' || i.isMandatory).length;
    const potentialGain = Math.min(30, (criticalMissingCount * 5) + (notInResumeList.length * 1));
    const potentialAtsScore = Math.min(98, Math.max(currentScore, currentScore + potentialGain));

    // 8. Generate Section-by-Section Actionable Improvements
    const sectionImprovements = {
        PROFILE: [],
        SKILLS: [],
        EXPERIENCE: [],
        PROJECTS: []
    };

    // Profile headline & role alignment check
    const jdRoleMatch = jdText.match(/(?:role|title|position):\s*([^\n\r.]+)/i) || jdText.match(/(?:seeking|hiring|for)\s+(?:a|an)?\s*([a-z\s]+intern(?:ship)?|[a-z\s]+engineer|[a-z\s]+developer)/i);
    const targetRole = jdRoleMatch ? jdRoleMatch[1].trim() : (parsedJD.archetype === 'INTERNSHIP_GRADUATE' ? 'Software Development Intern' : 'Software Engineer');

    const firstTwoLines = plainResumeText.split(/\r?\n/).slice(0, 3).join(' ').toLowerCase();
    if (!firstTwoLines.includes(targetRole.toLowerCase())) {
        sectionImprovements.PROFILE.push({
            type: 'HEADLINE_ALIGNMENT',
            importance: 'CRITICAL',
            title: 'Target Role Headline Missing',
            description: `Add an explicit headline '${targetRole}' directly under your name and in your Profile summary for immediate ATS title matching.`,
            estimatedGain: 8,
            suggestedSnippet: `${targetRole}`
        });
    }

    // Skills section gaps
    const missingSkillsForSkillsSection = notInResumeList.filter(i => i.suggestedSection === 'SKILLS').slice(0, 8);
    if (missingSkillsForSkillsSection.length > 0) {
        const skillNames = missingSkillsForSkillsSection.map(s => s.name);
        sectionImprovements.SKILLS.push({
            type: 'MISSING_KEY_SKILLS',
            importance: 'CRITICAL',
            title: `Add ${skillNames.length} Missing Technical Skills`,
            description: `Insert these exact required skills into your SKILLS section: ${skillNames.join(', ')}.`,
            skillsToAdd: skillNames,
            estimatedGain: Math.min(15, skillNames.length * 3),
            suggestedSnippet: skillNames.join(', ')
        });
    }

    // Experience section quantifiable improvements
    const nonMetricBullets = analyzeMetricDeficiencies(plainResumeText);
    if (nonMetricBullets.length > 0) {
        sectionImprovements.EXPERIENCE.push({
            type: 'QUANTIFY_METRICS',
            importance: 'HIGH',
            title: 'Add Measurable Business Metrics',
            description: 'Many bullet points lack numerical results. Quantify your contributions with percentages (%), latency drops (ms), user scale, or downtime reduction.',
            examples: [
                'Reduced deployment latency by 35% through Redis caching.',
                'Automated end-to-end testing, saving 15+ engineering hours per week.'
            ],
            targetBullets: nonMetricBullets,
            estimatedGain: 6
        });
    }

    // Missing domain keywords for Experience & Projects
    const missingDomain = notInResumeList.filter(i => i.category === 'AI_ML' || i.category === 'TESTING_QA' || i.category === 'CLOUD_DEVOPS').slice(0, 4);
    if (missingDomain.length > 0) {
        sectionImprovements.EXPERIENCE.push({
            type: 'DOMAIN_CONTEXT',
            importance: 'HIGH',
            title: 'Integrate Domain-Specific Responsibilities',
            description: `Incorporate active keywords (${missingDomain.map(d => d.name).join(', ')}) into your work achievements to match employer expectations.`,
            estimatedGain: 5
        });
    }

    // Projects section improvements
    const hasLiveDemo = /live demo|github|portfolio|vercel\.app/i.test(plainResumeText);
    if (!hasLiveDemo) {
        sectionImprovements.PROJECTS.push({
            type: 'PORTFOLIO_LINKS',
            importance: 'MEDIUM',
            title: 'Include Live Demo or GitHub Links',
            description: 'Add clickable Live Demo or repository links to validate project authenticity.',
            estimatedGain: 3
        });
    }

    return {
        success: true,
        currentAtsScore: currentScore,
        potentialAtsScore,
        scoreGainPotential: Math.max(0, potentialAtsScore - currentScore),
        metrics: {
            newAddedCount: newAddedList.length,
            retainedCount: retainedList.length,
            notInResumeCount: notInResumeList.length,
            criticalGapsCount: notInResumeList.filter(i => i.criticality === 'CRITICAL').length
        },
        differencePanel: {
            newAdded: newAddedList,
            retained: retainedList,
            notInResume: notInResumeList
        },
        sectionImprovements,
        quickActionPresets: [
            {
                id: 'insert_missing_skills',
                label: 'Insert Missing Technical Skills',
                targetSection: 'SKILLS',
                items: missingSkillsForSkillsSection.map(s => s.name)
            },
            {
                id: 'align_role_headline',
                label: `Align Target Role (${targetRole})`,
                targetSection: 'PROFILE',
                headline: targetRole
            },
            {
                id: 'add_metrics_experience',
                label: 'Quantify Experience Bullets',
                targetSection: 'EXPERIENCE'
            }
        ]
    };
}

module.exports = {
    extractATSImprovements,
    categorizeSkill,
    suggestTargetSection,
    analyzeMetricDeficiencies
};
