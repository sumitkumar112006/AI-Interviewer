/**
 * @file Chunker.js
 * @module ai-assistant/Chunker
 *
 * RESPONSIBILITY:
 *   Parse the raw HTML resume (fetched from MongoDB) into an array of
 *   semantic "chunks". Each chunk represents one logical unit of the resume
 *   (a name, a contact line, an experience entry header, a bullet point,
 *   a skill tag, a project header, an education entry, etc.).
 *
 *   This chunked array is the foundation for the Resume RAG Engine.
 *   It is passed to Embedder.js for vector generation and to
 *   contextAssembler.js for semantic retrieval.
 *
 * CHUNK TYPES:
 *   "name"          - Candidate's full name (h1)
 *   "contact"       - Contact line (email, phone, LinkedIn, GitHub)
 *   "summary"       - Professional summary paragraph
 *   "section_label" - Section heading itself (e.g. "Experience")
 *   "exp_header"    - Experience entry header (company + role + dates)
 *   "proj_header"   - Project entry header (project name + tech stack)
 *   "edu_header"    - Education entry header (university + degree + year)
 *   "bullet"        - A single <li> bullet point (under exp / project / edu)
 *   "skill_group"   - A group of skills under one category label
 */

'use strict';

// ─── Section keyword maps ─────────────────────────────────────────────────────

const SECTION_MAP = {
    experience : ['experience', 'work experience', 'employment', 'work history', 'career'],
    projects   : ['projects', 'personal projects', 'side projects', 'portfolio', 'open source'],
    education  : ['education', 'academic background', 'qualifications', 'academics'],
    skills     : ['skills', 'technical skills', 'core competencies', 'technologies', 'tech stack'],
    summary    : ['summary', 'profile', 'about me', 'objective', 'professional summary', 'overview'],
};

/**
 * Resolve a heading text to a canonical section key.
 * @param {string} text
 * @returns {string|null}
 */
function resolveSection(text) {
    const normalized = text.trim().toLowerCase();
    for (const [key, aliases] of Object.entries(SECTION_MAP)) {
        if (aliases.some(alias => normalized.includes(alias))) return key;
    }
    return null;
}

// ─── Tiny HTML utilities (no external parser dependency) ─────────────────────

/**
 * Strip all HTML tags and collapse whitespace to plain text.
 * @param {string} html
 * @returns {string}
 */
function stripTags(html = '') {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div|li|h[1-6]|section|article|header|footer)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#\d+;/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Extract all occurrences of a tag's outerHTML (non-nested).
 * @param {string} html
 * @param {string} tag  e.g. "li", "p", "h2"
 * @returns {string[]}
 */
function extractTags(html, tag) {
    const matches = [];
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
        matches.push(match[0]);
    }
    return matches;
}

/**
 * Extract first match of a tag's inner content.
 * @param {string} html
 * @param {string} tag
 * @returns {string|null}
 */
function extractFirstInner(html, tag) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = regex.exec(html);
    return match ? match[1] : null;
}

// ─── Chunk ID generator ───────────────────────────────────────────────────────

let _chunkSeq = 0;
function nextId(prefix = 'chunk') { return `${prefix}_${++_chunkSeq}`; }
function resetSeq() { _chunkSeq = 0; }

// ─── Chunk factory ────────────────────────────────────────────────────────────

/**
 * Build a chunk object with all required metadata fields.
 * @param {object} opts
 * @returns {object}
 */
function makeChunk({ prefix = 'chunk', type, section, sectionIndex = 0, parentId = null, html = '', text = '' }) {
    const cleanText = text || stripTags(html);
    return {
        id           : nextId(prefix),
        type,
        section,
        sectionIndex,
        parentId,
        text         : cleanText,
        html,
        charCount    : cleanText.length,
        wordCount    : cleanText.split(/\s+/).filter(Boolean).length,
    };
}

// ─── Section parsers ──────────────────────────────────────────────────────────

/**
 * Split sectionHTML into repeating entry groups. Each group is demarcated by
 * an <h3> or <h4> heading inside the section (company / project / university).
 * @param {string} sectionHtml
 * @returns {string[]}
 */
function splitIntoEntries(sectionHtml) {
    const parts = sectionHtml.split(/(?=<h[34][^>]*>)/i);
    return parts.filter(p => p.trim().length > 0);
}

/**
 * Parse the Experience section.
 * Each entry → exp_header chunk + N bullet chunks.
 * @param {string} sectionHtml
 * @param {object[]} chunks
 */
function parseExperienceSection(sectionHtml, chunks) {
    const entries = splitIntoEntries(sectionHtml);
    entries.forEach((entryHtml, idx) => {
        const headerHtml = extractFirstInner(entryHtml, 'h[34]') || '';
        if (headerHtml || idx === 0) {
            const headerChunk = makeChunk({
                type         : 'exp_header',
                section      : 'experience',
                sectionIndex : idx,
                html         : entryHtml.match(/<h[34][^>]*>[\s\S]*?<\/h[34]>/i)?.[0] || '',
                text         : stripTags(headerHtml),
            });
            chunks.push(headerChunk);

            const bullets = extractTags(entryHtml, 'li');
            bullets.forEach(liHtml => {
                const text = stripTags(liHtml);
                if (text) {
                    chunks.push(makeChunk({
                        type         : 'bullet',
                        section      : 'experience',
                        sectionIndex : idx,
                        parentId     : headerChunk.id,
                        html         : liHtml,
                        text,
                    }));
                }
            });
        }
    });
}

/**
 * Parse the Projects section.
 * @param {string} sectionHtml
 * @param {object[]} chunks
 */
function parseProjectsSection(sectionHtml, chunks) {
    const entries = splitIntoEntries(sectionHtml);
    entries.forEach((entryHtml, idx) => {
        const headerRaw = entryHtml.match(/<h[34][^>]*>[\s\S]*?<\/h[34]>/i)?.[0] || '';
        if (headerRaw) {
            const projChunk = makeChunk({
                type         : 'proj_header',
                section      : 'projects',
                sectionIndex : idx,
                html         : headerRaw,
                text         : stripTags(headerRaw),
            });
            chunks.push(projChunk);

            const bullets = extractTags(entryHtml, 'li');
            bullets.forEach(liHtml => {
                const text = stripTags(liHtml);
                if (text) {
                    chunks.push(makeChunk({
                        type         : 'bullet',
                        section      : 'projects',
                        sectionIndex : idx,
                        parentId     : projChunk.id,
                        html         : liHtml,
                        text,
                    }));
                }
            });
        }
    });
}

/**
 * Parse the Education section.
 * @param {string} sectionHtml
 * @param {object[]} chunks
 */
function parseEducationSection(sectionHtml, chunks) {
    const entries = splitIntoEntries(sectionHtml);
    entries.forEach((entryHtml, idx) => {
        const headerRaw = entryHtml.match(/<h[34][^>]*>[\s\S]*?<\/h[34]>/i)?.[0] || '';
        if (headerRaw) {
            const eduChunk = makeChunk({
                type         : 'edu_header',
                section      : 'education',
                sectionIndex : idx,
                html         : headerRaw,
                text         : stripTags(headerRaw),
            });
            chunks.push(eduChunk);

            const bullets = extractTags(entryHtml, 'li');
            bullets.forEach(liHtml => {
                const text = stripTags(liHtml);
                if (text) {
                    chunks.push(makeChunk({
                        type         : 'bullet',
                        section      : 'education',
                        sectionIndex : idx,
                        parentId     : eduChunk.id,
                        html         : liHtml,
                        text,
                    }));
                }
            });

            // Pick up standalone <p> inside education (e.g. GPA, honours)
            const paras = extractTags(entryHtml, 'p');
            paras.forEach(pHtml => {
                const text = stripTags(pHtml);
                if (text) {
                    chunks.push(makeChunk({
                        type         : 'bullet',
                        section      : 'education',
                        sectionIndex : idx,
                        parentId     : eduChunk.id,
                        html         : pHtml,
                        text,
                    }));
                }
            });
        }
    });
}

/**
 * Parse the Skills section — group each <li> or <p> as a skill_group chunk.
 * @param {string} sectionHtml
 * @param {object[]} chunks
 */
function parseSkillsSection(sectionHtml, chunks) {
    const items = [
        ...extractTags(sectionHtml, 'li'),
        ...extractTags(sectionHtml, 'p'),
        ...extractTags(sectionHtml, 'span'),
    ];

    // Deduplicate by raw html to avoid span-inside-li double counting
    const seen = new Set();
    items.forEach((itemHtml, idx) => {
        if (seen.has(itemHtml)) return;
        seen.add(itemHtml);
        const text = stripTags(itemHtml);
        if (text.length > 1) {
            chunks.push(makeChunk({
                type         : 'skill_group',
                section      : 'skills',
                sectionIndex : idx,
                html         : itemHtml,
                text,
            }));
        }
    });
}

/**
 * Parse the Summary section.
 * @param {string} sectionHtml
 * @param {object[]} chunks
 */
function parseSummarySection(sectionHtml, chunks) {
    const paras = extractTags(sectionHtml, 'p');
    paras.forEach((pHtml, idx) => {
        const text = stripTags(pHtml);
        if (text) {
            chunks.push(makeChunk({
                type         : 'summary',
                section      : 'summary',
                sectionIndex : idx,
                html         : pHtml,
                text,
            }));
        }
    });

    // Fallback: if no <p> tags, treat entire section inner as summary
    if (!paras.length) {
        const text = stripTags(sectionHtml);
        if (text) {
            chunks.push(makeChunk({
                type    : 'summary',
                section : 'summary',
                html    : sectionHtml,
                text,
            }));
        }
    }
}

// ─── Top-level name & contact extraction ────────────────────────────────────

/**
 * Extract the candidate name from h1.
 * @param {string} html
 * @param {object[]} chunks
 */
function extractName(html, chunks) {
    const h1Html = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[0];
    if (h1Html) {
        const text = stripTags(h1Html);
        if (text) {
            chunks.push(makeChunk({ type: 'name', section: 'header', html: h1Html, text }));
        }
    }
}

/**
 * Extract contact info — anchor tags with email/phone/LinkedIn/GitHub,
 * or a <p> containing @ or phone pattern near the top.
 * @param {string} html
 * @param {object[]} chunks
 */
function extractContact(html, chunks) {
    const contactPatterns = /mailto:|tel:|linkedin\.com|github\.com/i;
    const anchorTags = extractTags(html, 'a');
    const contactAnchors = anchorTags.filter(a => contactPatterns.test(a));

    if (contactAnchors.length > 0) {
        const combined = contactAnchors.map(stripTags).join(' | ');
        chunks.push(makeChunk({
            type    : 'contact',
            section : 'header',
            html    : contactAnchors.join(' '),
            text    : combined,
        }));
        return;
    }

    // Fallback: look for a <p> near the top that has @ or phone pattern
    const pTags = extractTags(html.slice(0, 1200), 'p');
    const contactP = pTags.find(p => /@|(\+?\d[\d\s\-()]{7,})/.test(stripTags(p)));
    if (contactP) {
        chunks.push(makeChunk({
            type    : 'contact',
            section : 'header',
            html    : contactP,
            text    : stripTags(contactP),
        }));
    }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Parse raw HTML resume into an array of semantic chunks.
 *
 * @param {string} html  - Raw HTML string of the resume document
 * @returns {object[]}   - Flat array of chunk objects (ready for embedding)
 */
function parseResumeHtml(html) {
    if (!html || typeof html !== 'string') {
        console.warn('[Chunker] parseResumeHtml called with empty or non-string HTML');
        return [];
    }

    resetSeq();
    const chunks = [];

    // ── 1. Header: name & contact ─────────────────────────────────────────
    extractName(html, chunks);
    extractContact(html, chunks);

    // ── 2. Identify section boundaries via h2 tags ────────────────────────
    //    Split the full HTML by <h2> boundaries to isolate each section blob
    const sectionBlobs = html.split(/(?=<h2[^>]*>)/i).filter(b => b.trim());

    for (const blob of sectionBlobs) {
        const h2Match = blob.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        if (!h2Match) continue;

        const headingText = stripTags(h2Match[1]);
        const sectionKey  = resolveSection(headingText);

        if (!sectionKey) continue;

        // Emit section_label chunk
        chunks.push(makeChunk({
            type    : 'section_label',
            section : sectionKey,
            html    : h2Match[0],
            text    : headingText,
        }));

        // The rest of the blob after the h2 = section body
        const bodyHtml = blob.slice(h2Match.index + h2Match[0].length);

        switch (sectionKey) {
            case 'experience': parseExperienceSection(bodyHtml, chunks); break;
            case 'projects'  : parseProjectsSection(bodyHtml, chunks);   break;
            case 'education' : parseEducationSection(bodyHtml, chunks);   break;
            case 'skills'    : parseSkillsSection(bodyHtml, chunks);      break;
            case 'summary'   : parseSummarySection(bodyHtml, chunks);     break;
            default          : break;
        }
    }

    // ── 3. Log summary ────────────────────────────────────────────────────
    const counts = chunks.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
    }, {});

    console.log(`[Chunker] ✅ Parsed ${chunks.length} chunks from resume HTML`);
    console.log(`[Chunker] 📊 Chunk type breakdown:`, counts);
    console.log(`[Chunker] 📋 All chunks:`, JSON.stringify(chunks.map(c => ({
        id           : c.id,
        type         : c.type,
        section      : c.section,
        sectionIndex : c.sectionIndex,
        wordCount    : c.wordCount,
        text         : c.text.slice(0, 80) + (c.text.length > 80 ? '…' : ''),
    })), null, 2));

    return chunks;
}

// ─── Roadmap Chunker ─────────────────────────────────────────────────────────

/**
 * Parse structured preparation plan into semantic chunks.
 * @param {Array} preparationPlan - [{ day: 'Day 1', focus: '...', tasks: ['...'] }]
 * @param {Array} completedTasks - ['task text 1', ...]
 * @returns {object[]} - Flat array of chunk objects ready for embedding/retrieval
 */
function parseRoadmap(preparationPlan = [], completedTasks = []) {
    if (!Array.isArray(preparationPlan) || preparationPlan.length === 0) {
        return [];
    }

    resetSeq();
    const completedSet = new Set((completedTasks || []).map(t => typeof t === 'string' ? t.trim().toLowerCase() : ''));
    const chunks = [];

    // 1. Overview chunk
    const totalDays = preparationPlan.length;
    const totalTasks = preparationPlan.reduce((acc, d) => acc + (Array.isArray(d?.tasks) ? d.tasks.length : 0), 0);
    const completedCount = completedSet.size;
    const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    chunks.push(makeChunk({
        prefix: 'roadmap',
        type: 'roadmap_overview',
        section: 'roadmap',
        text: `14-Day Interview Preparation Roadmap: ${totalDays} milestones, ${totalTasks} total tasks, ${completedCount} completed (${progressPercent}% progress).`
    }));

    // 2. Day-by-day chunks & task chunks
    preparationPlan.forEach((dayNode, dayIdx) => {
        if (!dayNode) return;
        const dayLabel = dayNode.day || `Day ${dayIdx + 1}`;
        const focus = dayNode.focus || 'Technical Preparation';
        const tasks = Array.isArray(dayNode.tasks) ? dayNode.tasks.filter(Boolean) : [];

        const dayChunk = makeChunk({
            prefix: 'roadmap',
            type: 'roadmap_day',
            section: 'roadmap',
            sectionIndex: dayIdx,
            text: `${dayLabel}: ${focus}. Key milestone objectives and exercises.`
        });
        chunks.push(dayChunk);

        tasks.forEach((task, taskIdx) => {
            const isDone = completedSet.has(task.trim().toLowerCase());
            chunks.push(makeChunk({
                prefix: 'roadmap',
                type: 'roadmap_task',
                section: 'roadmap',
                sectionIndex: dayIdx,
                parentId: dayChunk.id,
                text: `${dayLabel} Task: ${task} [Status: ${isDone ? 'Completed' : 'Pending'}]`
            }));
        });
    });

    console.log(`[Chunker] ✅ Parsed ${chunks.length} chunks from Roadmap (${totalDays} days, ${totalTasks} tasks)`);
    return chunks;
}

// ─── Job Description Chunker ──────────────────────────────────────────────────

/**
 * Parse raw Job Description into semantic chunks (responsibilities, requirements, tech stack, qualifications).
 * @param {string} jobDescription - Raw JD string (plain text or HTML)
 * @param {string} developerTitle - Target role title (e.g. "Full Stack Developer")
 * @returns {object[]} - Flat array of chunk objects ready for embedding/retrieval
 */
function parseJobDescription(jobDescription = '', developerTitle = '') {
    if (!jobDescription || typeof jobDescription !== 'string') {
        return [];
    }

    const cleanText = jobDescription
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div|li|h[1-6]|section|article)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .trim();

    if (!cleanText) return [];

    resetSeq();
    const chunks = [];

    // 1. Role / Title chunk
    if (developerTitle && developerTitle.trim()) {
        chunks.push(makeChunk({
            prefix: 'jd',
            type: 'jd_title',
            section: 'job_description',
            text: `Target Job Title & Role: ${developerTitle.trim()}`
        }));
    }

    // 2. Split into lines
    const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    let currentSection = 'general';
    let sectionIdx = 0;

    lines.forEach((line) => {
        // Section header detection
        if (/^(?:responsibilities|duties|what you will do|what you'll do|key responsibilities|day to day|role overview):?/i.test(line)) {
            currentSection = 'responsibilities';
            sectionIdx++;
            chunks.push(makeChunk({
                prefix: 'jd',
                type: 'jd_section_label',
                section: 'job_description',
                sectionIndex: sectionIdx,
                text: `Responsibilities Section: ${line}`
            }));
            return;
        }

        if (/^(?:requirements|qualifications|what we look for|must have|what you need|skills required|basic qualifications):?/i.test(line)) {
            currentSection = 'requirements';
            sectionIdx++;
            chunks.push(makeChunk({
                prefix: 'jd',
                type: 'jd_section_label',
                section: 'job_description',
                sectionIndex: sectionIdx,
                text: `Requirements Section: ${line}`
            }));
            return;
        }

        if (/^(?:preferred qualifications|nice to have|bonus|good to have|desired skills):?/i.test(line)) {
            currentSection = 'preferred';
            sectionIdx++;
            chunks.push(makeChunk({
                prefix: 'jd',
                type: 'jd_section_label',
                section: 'job_description',
                sectionIndex: sectionIdx,
                text: `Preferred Qualifications Section: ${line}`
            }));
            return;
        }

        if (/^(?:tech stack|technologies|tools|stack|technical skills):?/i.test(line)) {
            currentSection = 'tech_stack';
            sectionIdx++;
            chunks.push(makeChunk({
                prefix: 'jd',
                type: 'jd_section_label',
                section: 'job_description',
                sectionIndex: sectionIdx,
                text: `Tech Stack Section: ${line}`
            }));
            return;
        }

        // Individual bullet points or sentences
        const isBullet = /^[•\-\*\d\.\)\s]+/.test(line);
        const cleanBulletText = line.replace(/^[•\-\*\d\.\)\s]+/, '').trim();

        if (cleanBulletText.length < 5) return;

        let chunkType = 'jd_section';
        if (currentSection === 'responsibilities') chunkType = 'jd_responsibility';
        else if (currentSection === 'requirements') chunkType = 'jd_requirement';
        else if (currentSection === 'preferred') chunkType = 'jd_preferred';
        else if (currentSection === 'tech_stack') chunkType = 'jd_tech_stack';
        else if (isBullet) chunkType = 'jd_requirement';

        chunks.push(makeChunk({
            prefix: 'jd',
            type: chunkType,
            section: 'job_description',
            sectionIndex: sectionIdx,
            text: `${developerTitle ? `[${developerTitle}] ` : ''}${cleanBulletText}`
        }));
    });

    // Fallback: If text was a single monolithic paragraph without line breaks
    if (chunks.length <= 1) {
        const sentences = cleanText.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.trim().length > 15);
        sentences.forEach((s, idx) => {
            chunks.push(makeChunk({
                prefix: 'jd',
                type: 'jd_requirement',
                section: 'job_description',
                sectionIndex: idx,
                text: s.trim()
            }));
        });
    }

    console.log(`[Chunker] ✅ Parsed ${chunks.length} chunks from Job Description`);
    return chunks;
}

module.exports = {
    parseResumeHtml,
    parseRoadmap,
    parseJobDescription
};
