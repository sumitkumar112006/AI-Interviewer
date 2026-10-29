const { MAJOR_SKILLS_DICTIONARY } = require('../constants/skills.constants');

/**
 * Scan raw text (resume, job description, technical questions, skill gaps)
 * and extract matching canonical major skills.
 */
function extractMajorSkillsFromText(text = '') {
    if (!text || typeof text !== 'string') return [];
    const lowerText = text.toLowerCase();
    const matchedSkills = [];

    for (const item of MAJOR_SKILLS_DICTIONARY) {
        const isMatched = item.aliases.some(alias => {
            // Match whole word or exact term boundaries to prevent substring false positives
            const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
            return regex.test(lowerText);
        });

        if (isMatched) {
            matchedSkills.push({
                name: item.name,
                category: item.category
            });
        }
    }

    return matchedSkills;
}

/**
 * Extract normalized skills from a report object and calculate initial proficiency scores.
 */
function processReportSkills(report) {
    if (!report) return [];

    const fullText = [
        report.developerTitle || '',
        report.resume || '',
        report.jobDescription || '',
        ...(report.technicalQuestions || []).map(q => `${q.question || ''} ${q.answer || ''}`),
        ...(report.skillGaps || []).map(g => g.skill || '')
    ].join(' ');

    const detected = extractMajorSkillsFromText(fullText);
    const overallScore = typeof report.matchScore === 'number' ? report.matchScore : 75;

    // Create map of skill gaps for penalty adjustment
    const gapMap = {};
    (report.skillGaps || []).forEach(g => {
        if (!g.skill) return;
        const normalizedGap = extractMajorSkillsFromText(g.skill);
        normalizedGap.forEach(sk => {
            const penalty = g.severity === 'high' ? 35 : g.severity === 'medium' ? 20 : 10;
            gapMap[sk.name] = Math.max(gapMap[sk.name] || 0, penalty);
        });
    });

    return detected.map(sk => {
        const penalty = gapMap[sk.name] || 0;
        const calculatedScore = Math.max(30, Math.min(100, overallScore - penalty));
        return {
            name: sk.name,
            category: sk.category,
            score: calculatedScore
        };
    });
}

/**
 * Aggregates skill statistics across an array of interview reports.
 */
function aggregateSkillAnalytics(reports = []) {
    if (!Array.isArray(reports) || reports.length === 0) {
        return {
            totalInterviews: 0,
            topSkills: [],
            categories: [],
            skillDistribution: []
        };
    }

    const skillMap = {};

    reports.forEach(report => {
        let skills = report.detectedSkills;
        if (!skills || skills.length === 0) {
            skills = processReportSkills(report);
        }

        skills.forEach(sk => {
            if (!skillMap[sk.name]) {
                skillMap[sk.name] = {
                    name: sk.name,
                    category: sk.category,
                    count: 0,
                    scores: []
                };
            }
            skillMap[sk.name].count += 1;
            skillMap[sk.name].scores.push(sk.score || 75);
        });
    });

    const processedSkills = Object.values(skillMap).map(item => {
        const avgScore = Math.round(item.scores.reduce((a, b) => a + b, 0) / item.scores.length);
        return {
            name: item.name,
            category: item.category,
            count: item.count,
            avgScore,
            percentage: Math.round((item.count / reports.length) * 100)
        };
    });

    // Seamlessly filter out any skill where average evaluated knowledge is less than 50%
    const qualifiedSkills = processedSkills.filter(sk => sk.avgScore >= 50);

    // Sort qualified skills by frequency count (descending), then by average score
    qualifiedSkills.sort((a, b) => b.count - a.count || b.avgScore - a.avgScore);

    // Group stats by Category for qualified skills
    const categoryMap = {};
    qualifiedSkills.forEach(sk => {
        if (!categoryMap[sk.category]) {
            categoryMap[sk.category] = { category: sk.category, count: 0, totalScore: 0 };
        }
        categoryMap[sk.category].count += sk.count;
        categoryMap[sk.category].totalScore += sk.avgScore * sk.count;
    });

    const categories = Object.values(categoryMap).map(c => ({
        category: c.category,
        count: c.count,
        avgScore: Math.round(c.totalScore / (c.count || 1))
    }));

    return {
        totalReports: reports.length,
        topSkills: qualifiedSkills.slice(0, 10),
        allSkills: qualifiedSkills,
        categories
    };
}

/**
 * Extracts a normalized, clean array of skills from resume HTML.
 * Focuses on the <h2>SKILLS</h2> section and cross-references canonical aliases.
 * 
 * @param {string} htmlContent - HTML markup of the resume
 * @returns {string[]} - Array of unique skill names
 */
function extractSkillsFromResumeHtml(htmlContent) {
    if (!htmlContent || typeof htmlContent !== 'string') return [];

    const found = new Set();
    const normalizedHtml = String(htmlContent);

    // 1. Try to extract specifically from the <h2>SKILLS</h2> section
    const skillsSectionMatch = normalizedHtml.match(/<h[1-3][^>]*>[\s\S]*?skills[\s\S]*?<\/h[1-3]>([\s\S]*?)(?=<h[1-3]|$)/i);
    const targetBlock = skillsSectionMatch ? skillsSectionMatch[1] : normalizedHtml;

    // Decode HTML entities and add separators for block tags
    let decodedBlock = targetBlock
        .replace(/&amp;/gi, '&')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/<\/(li|p|div|h[1-6]|tr|td)>/gi, ', ')
        .replace(/<(?:strong|b)\b[^>]*>[\s\S]*?<\/(?:strong|b)>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');

    // Preserve common slash acronyms like A/B Testing, CI/CD, TCP/IP
    decodedBlock = decodedBlock
        .replace(/\bA\/B\b/gi, 'A_SLASH_B')
        .replace(/\bCI\/CD\b/gi, 'CI_SLASH_CD')
        .replace(/\bTCP\/IP\b/gi, 'TCP_SLASH_IP');

    // Split items by commas, semicolons, bullets (•, ·, |), or standalone slashes
    const rawTokens = decodedBlock.split(/[,;•·|\n\r\t]+|\s+\/\s+/);
    for (let raw of rawTokens) {
        let token = raw
            .replace(/\(.*?\)/g, ' ')
            .replace(/A_SLASH_B/gi, 'A/B')
            .replace(/CI_SLASH_CD/gi, 'CI/CD')
            .replace(/TCP_SLASH_IP/gi, 'TCP/IP')
            .replace(/[^a-zA-Z0-9+#.\s/&-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Remove common headings/filler prefixes
        token = token.replace(/^(and|etc|tools|platforms|skills|technologies|frameworks|languages)\s+/i, '').trim();
        if (token.length >= 2 && token.length <= 40 && !/^\d+$/.test(token) && !/^(amp|nbsp|and|etc)$/i.test(token)) {
            found.add(token);
        }
    }

    // 2. Cross-reference canonical MAJOR_SKILLS_DICTIONARY for accurate casing
    try {
        if (Array.isArray(MAJOR_SKILLS_DICTIONARY)) {
            const lowerHtml = normalizedHtml.toLowerCase();
            for (const item of MAJOR_SKILLS_DICTIONARY) {
                const isMatched = item.aliases.some(alias => {
                    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
                    return regex.test(lowerHtml);
                });
                if (isMatched) {
                    found.add(item.name);
                }
            }
        }
    } catch (_) {}

    // Deduplicate case-insensitively
    const result = [];
    const lowerSet = new Set();
    for (const sk of found) {
        const lower = sk.toLowerCase();
        if (!lowerSet.has(lower) && sk.trim().length > 1) {
            lowerSet.add(lower);
            result.push(sk.trim());
        }
    }

    return result;
}

/**
 * Extracts skills from raw text (such as original uploaded resume text).
 * Combines dictionary alias matching with pattern scanning of skills sections.
 * 
 * @param {string} text - Raw text from original resume
 * @returns {string[]} - Array of distinct skill names
 */
function extractSkillsFromRawResumeText(text = '') {
    if (!text || typeof text !== 'string') return [];

    const found = new Set();
    const lowerText = text.toLowerCase();

    // 1. Match against canonical MAJOR_SKILLS_DICTIONARY aliases
    if (Array.isArray(MAJOR_SKILLS_DICTIONARY)) {
        for (const item of MAJOR_SKILLS_DICTIONARY) {
            const isMatched = item.aliases.some(alias => {
                const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
                return regex.test(lowerText);
            });
            if (isMatched) {
                found.add(item.name);
            }
        }
    }

    // 2. Scan dedicated skills header block in raw text if present
    const sectionMatch = text.match(/(?:technical\s+skills|skills\s*&?\s*technologies|core\s+competencies|skills)\s*[:\n]([\s\S]*?)(?=(?:\n[A-Z\s]{4,}:|\n\n[A-Z][a-z]+|\n\n|\r\n\r\n|$))/i);
    if (sectionMatch && sectionMatch[1]) {
        const rawTokens = sectionMatch[1].split(/[,;•·|\n\r\t/]+/);
        for (let raw of rawTokens) {
            let token = raw.replace(/\(.*?\)/g, ' ').replace(/[^a-zA-Z0-9+#.\s-]/g, ' ').trim();
            token = token.replace(/^(and|etc|tools|platforms|skills|technologies|frameworks|languages)\s+/i, '').trim();
            if (token.length >= 2 && token.length <= 40 && !/^\d+$/.test(token)) {
                found.add(token);
            }
        }
    }

    // Deduplicate case-insensitively
    const result = [];
    const seenLower = new Set();
    for (const sk of found) {
        const lower = sk.toLowerCase().trim();
        if (lower && !seenLower.has(lower)) {
            seenLower.add(lower);
            result.push(sk.trim());
        }
    }

    return result;
}

/**
 * Compares original resume skills vs. current resume skills and formats
 * them into color-differentiated versions:
 * - New skills added in current resume: color "green" (#10b981)
 * - Previous skills retained from original resume: color "blue" (#3b82f6)
 * 
 * Returns an object containing all current skills with both arrays inside it,
 * plus the tagged combined array with color diff metadata.
 * 
 * @param {Object} options
 * @param {string} options.originalResumeText - Raw text of original uploaded resume
 * @param {string} options.currentResumeHtml - HTML markup of current generated/edited resume
 * @param {string[]} [options.currentResumeSkills] - Existing resumeSkills array from DB
 * @param {Array} [options.detectedSkills] - Detected skills from initial report
 * @returns {Object} Structured comparison object
 */
function compareResumeSkillsDiff({
    originalResumeText = '',
    currentResumeHtml = '',
    currentResumeSkills = [],
    detectedSkills = []
}) {
    // 1. Extract skills from the original resume text
    const originalSkillsSet = new Set(extractSkillsFromRawResumeText(originalResumeText));

    // Also include skills from detectedSkills that actually appear in originalResumeText
    if (Array.isArray(detectedSkills)) {
        const lowerRaw = (originalResumeText || '').toLowerCase();
        for (const item of detectedSkills) {
            const skillName = typeof item === 'string' ? item : item?.name;
            if (skillName && lowerRaw.includes(skillName.toLowerCase())) {
                originalSkillsSet.add(skillName);
            }
        }
    }

    const originalSkillsArray = Array.from(originalSkillsSet);
    const origLowerMap = new Map();
    originalSkillsArray.forEach(sk => {
        origLowerMap.set(sk.toLowerCase().trim(), sk);
    });

    // 2. Extract skills from the current resume (HTML + saved resumeSkills array)
    const currentSkillsRaw = new Set();
    if (Array.isArray(currentResumeSkills) && currentResumeSkills.length > 0) {
        currentResumeSkills.forEach(sk => {
            if (typeof sk === 'string' && sk.trim()) currentSkillsRaw.add(sk.trim());
        });
    }

    if (currentResumeHtml) {
        const fromHtml = extractSkillsFromResumeHtml(currentResumeHtml);
        fromHtml.forEach(sk => currentSkillsRaw.add(sk));
    }

    // 3. Classify current skills into 'new' (green) vs 'previous' (blue)
    const newSkills = [];
    const previousSkills = [];
    const allCurrentSkills = [];
    const currLowerSet = new Set();

    for (const skill of currentSkillsRaw) {
        const cleanSkill = skill.trim();
        const lower = cleanSkill.toLowerCase();
        if (!lower || currLowerSet.has(lower)) continue;
        currLowerSet.add(lower);

        if (origLowerMap.has(lower)) {
            // Previous / Retained Skill: Carried over from original resume -> Blue
            const skillObject = {
                name: cleanSkill,
                version: 'previous',
                color: 'blue',
                colorHex: '#3b82f6',
                isNewlyAdded: false
            };
            previousSkills.push(skillObject);
            allCurrentSkills.push(skillObject);
        } else {
            // New Skill: Added in current resume (via LLM, manual edit, or AI Assistant) -> Green
            const skillObject = {
                name: cleanSkill,
                version: 'new',
                color: 'green',
                colorHex: '#10b981',
                isNewlyAdded: true
            };
            newSkills.push(skillObject);
            allCurrentSkills.push(skillObject);
        }
    }

    // 4. Identify skills present in original resume but omitted from current resume
    const removedSkills = [];
    origLowerMap.forEach((origName, lower) => {
        if (!currLowerSet.has(lower)) {
            removedSkills.push({
                name: origName,
                version: 'removed',
                color: 'red',
                colorHex: '#ef4444'
            });
        }
    });

    // 5. Structure the current skills container object containing both sub-arrays and tagged all array
    const currentSkills = {
        all: allCurrentSkills,
        newSkills,
        previousSkills
    };

    return {
        currentSkills,
        originalSkills: originalSkillsArray,
        removedSkills,
        stats: {
            totalOriginal: originalSkillsArray.length,
            totalCurrent: allCurrentSkills.length,
            newCount: newSkills.length,
            previousCount: previousSkills.length,
            removedCount: removedSkills.length,
            retainedPercentage: originalSkillsArray.length > 0 
                ? Math.round((previousSkills.length / originalSkillsArray.length) * 100) 
                : 100
        }
    };
}

module.exports = {
    extractMajorSkillsFromText,
    processReportSkills,
    aggregateSkillAnalytics,
    extractSkillsFromResumeHtml,
    extractSkillsFromRawResumeText,
    compareResumeSkillsDiff
};

