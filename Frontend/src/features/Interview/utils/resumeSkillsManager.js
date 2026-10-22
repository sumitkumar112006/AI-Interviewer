/**
 * resumeSkillsManager.js
 * Utilities for extracting, synchronizing, adding, and removing skills
 * from resume HTML in real-time.
 */

// Common canonical tech skills for fallback matching
const COMMON_TECH_SKILLS = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Golang', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
    'React', 'React.js', 'Next.js', 'Vue', 'Vue.js', 'Angular', 'Node.js', 'Express', 'Express.js', 'Django', 'Flask', 'Spring Boot', 'FastAPI',
    'HTML', 'CSS', 'Tailwind CSS', 'Sass', 'SCSS', 'Bootstrap',
    'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Firebase', 'SQLite', 'Oracle', 'Cassandra', 'DynamoDB',
    'AWS', 'Azure', 'GCP', 'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'Linux', 'Terraform',
    'REST APIs', 'GraphQL', 'gRPC', 'Microservices', 'System Design', 'Kafka', 'RabbitMQ',
    'Jest', 'Cypress', 'Mocha', 'Selenium', 'Unit Testing', 'Webpack', 'Vite'
];

/**
 * Extracts a clean array of skills from resume HTML.
 * Focuses primarily on the <h2>SKILLS</h2> section and falls back to full-text scan.
 * 
 * @param {string} html - Resume HTML content
 * @returns {string[]} - Array of distinct skill names
 */
export function parseSkillsFromHtml(html) {
    if (!html || typeof html !== 'string') return [];

    const found = new Set();
    const normalizedHtml = String(html);

    // 1. Look for the dedicated Skills section in the HTML
    const skillsMatch = normalizedHtml.match(/<h[1-3][^>]*>[\s\S]*?skills[\s\S]*?<\/h[1-3]>([\s\S]*?)(?=<h[1-3]|$)/i);
    const targetBlock = skillsMatch ? skillsMatch[1] : '';

    if (targetBlock) {
        // Strip bold headers (e.g. <strong>Technical:</strong>, <b>Tools:</b>)
        const strippedBlock = targetBlock
            .replace(/<(?:strong|b)\b[^>]*>[\s\S]*?<\/(?:strong|b)>/gi, ' ')
            .replace(/<[^>]+>/g, ' ');
        
        // Split tokens by commas, semicolons, bullets, pipes, or newlines
        const tokens = strippedBlock.split(/[,;•·|\n\r\t/]+/);
        for (let token of tokens) {
            let clean = token.replace(/\(.*?\)/g, ' ').replace(/[^a-zA-Z0-9+#.\s-]/g, ' ').trim();
            // Remove common section filler prefixes
            clean = clean.replace(/^(and|etc|tools|platforms|skills|technologies|frameworks|languages|competencies)\s+/i, '').trim();
            if (clean.length >= 2 && clean.length <= 40 && !/^\d+$/.test(clean)) {
                found.add(clean);
            }
        }
    }

    // 2. Cross-reference common tech skills across the entire HTML to catch canonical names
    const lowerHtml = normalizedHtml.toLowerCase();
    for (const skill of COMMON_TECH_SKILLS) {
        const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
        if (regex.test(lowerHtml)) {
            // Check if not already covered
            let alreadyPresent = false;
            for (const existing of found) {
                if (existing.toLowerCase() === skill.toLowerCase()) {
                    alreadyPresent = true;
                    break;
                }
            }
            if (!alreadyPresent && targetBlock) {
                // If it was in the target skills block, definitely add it
                if (regex.test(targetBlock.toLowerCase())) {
                    found.add(skill);
                }
            } else if (!alreadyPresent && !targetBlock) {
                found.add(skill);
            }
        }
    }

    // Deduplicate case-insensitively
    const result = [];
    const seenLower = new Set();
    for (const s of found) {
        const lower = s.toLowerCase().trim();
        if (lower && !seenLower.has(lower)) {
            seenLower.add(lower);
            result.push(s.trim());
        }
    }

    return result;
}

/**
 * Extracts skills from raw text (such as original uploaded resume text).
 * 
 * @param {string} text - Raw text content
 * @returns {string[]} - Array of distinct skill names found
 */
export function parseSkillsFromText(text) {
    if (!text || typeof text !== 'string') return [];

    const found = new Set();
    const lowerText = text.toLowerCase();

    for (const skill of COMMON_TECH_SKILLS) {
        const escaped = skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|[^a-zA-Z0-9_#+])${escaped}(?:$|[^a-zA-Z0-9_#+])`, 'i');
        if (regex.test(lowerText)) {
            found.add(skill);
        }
    }

    return Array.from(found);
}

/**
 * Compares original resume skills vs. current resume skills to compute added,
 * removed, and retained skills with color differentiation:
 * - newSkills: green (#10b981)
 * - previousSkills: blue (#3b82f6)
 * 
 * @param {string[]} originalSkills - Skills from the original resume
 * @param {string[]} currentSkills - Skills from the generated/edited resume
 * @returns {Object} Structure containing currentSkills { all, newSkills, previousSkills }, originalSkills, removedSkills, and stats
 */
export function compareResumeSkills(originalSkills = [], currentSkills = []) {
    const origList = Array.isArray(originalSkills) ? originalSkills : [];
    const currList = Array.isArray(currentSkills) ? currentSkills : [];

    const origLowerMap = new Map();
    origList.forEach(s => {
        const clean = String(s || '').trim();
        if (clean) origLowerMap.set(clean.toLowerCase(), clean);
    });

    const currLowerMap = new Map();
    currList.forEach(s => {
        const clean = String(s || '').trim();
        if (clean) currLowerMap.set(clean.toLowerCase(), clean);
    });

    const newSkills = [];
    const previousSkills = [];
    const all = [];

    currLowerMap.forEach((originalCasing, lower) => {
        if (origLowerMap.has(lower)) {
            const item = {
                name: originalCasing,
                version: 'previous',
                color: 'blue',
                colorHex: '#3b82f6',
                isNew: false
            };
            previousSkills.push(item);
            all.push(item);
        } else {
            const item = {
                name: originalCasing,
                version: 'new',
                color: 'green',
                colorHex: '#10b981',
                isNew: true
            };
            newSkills.push(item);
            all.push(item);
        }
    });

    const removedSkills = [];
    origLowerMap.forEach((originalCasing, lower) => {
        if (!currLowerMap.has(lower)) {
            removedSkills.push({
                name: originalCasing,
                version: 'removed',
                color: 'gray',
                colorHex: '#94a3b8'
            });
        }
    });

    return {
        currentSkills: {
            all,
            newSkills,
            previousSkills
        },
        originalSkills: origList,
        removedSkills,
        stats: {
            totalOriginal: origList.length,
            totalCurrent: all.length,
            newCount: newSkills.length,
            previousCount: previousSkills.length,
            removedCount: removedSkills.length
        }
    };
}

/**
 * Merges two arrays of skills case-insensitively.
 * 
 * @param {string[]} existing - Base array of skills
 * @param {string[]} incoming - New skills to add
 * @returns {string[]} - Merged, distinct array
 */
export function mergeSkills(existing = [], incoming = []) {
    const list = Array.isArray(existing) ? [...existing] : [];
    const seen = new Set(list.map(s => String(s).toLowerCase().trim()));

    if (Array.isArray(incoming)) {
        for (const item of incoming) {
            const clean = String(item || '').trim();
            const lower = clean.toLowerCase();
            if (clean && !seen.has(lower)) {
                seen.add(lower);
                list.push(clean);
            }
        }
    }

    return list;
}

