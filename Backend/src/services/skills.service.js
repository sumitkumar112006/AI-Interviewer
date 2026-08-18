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

module.exports = {
    extractMajorSkillsFromText,
    processReportSkills,
    aggregateSkillAnalytics
};
