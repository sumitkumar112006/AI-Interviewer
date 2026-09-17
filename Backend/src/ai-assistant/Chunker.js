/**
 * @file resumeChunker.js
 * @module ai-assistant/resumeChunker
 *
 * RESPONSIBILITY:
 *   Parse the raw HTML resume (fetched from MongoDB) into an array of
 *   semantic "chunks". Each chunk represents one logical unit of the resume
 *   (a name, a contact line, an experience entry header, a bullet point,
 *   a skill tag, a project header, an education entry, etc.).
 *
 *   This chunked array is the foundation for the Resume RAG Engine.
 *   It is passed to resumeEmbedder.js for vector generation and to
 *   chunkSearchEngine.js for semantic retrieval.
 *
 * APPROACH: (see resume_rag_hld.md artifact for full design)
 *   1. Use an HTML parser (e.g. node-html-parser / cheerio) to walk the DOM.
 *   2. Identify semantic "section" boundaries (h2 tags like Experience,
 *      Projects, Education, Skills, Summary, etc.).
 *   3. Within each section, identify repeating groups (each job = one group,
 *      each project = one group) and assign a sectionIndex (0-based).
 *   4. Within each group, parse individual bullet points (<li>) as separate
 *      chunks so each bullet can be targeted independently.
 *   5. Attach metadata to every chunk: id, type, section, sectionIndex,
 *      parentId, text (plain), html (raw), charCount, wordCount.
 *   6. Return the flat chunks[] array.
 *
 * CHUNK TYPES:
 *   "name"        - Candidate's full name (h1)
 *   "contact"     - Contact line (email, phone, LinkedIn, GitHub)
 *   "summary"     - Professional summary paragraph
 *   "exp_header"  - Experience entry header (company + role + dates)
 *   "proj_header" - Project entry header (project name + tech stack)
 *   "edu_header"  - Education entry header (university + degree + year)
 *   "bullet"      - A single <li> bullet point (under exp / project / edu)
 *   "skill_group" - A group of skills under one category label
 *   "section_label" - The section heading itself (e.g. "Experience")
 *
 * TODO: Implement parseResumeHtml(html) → resumeChunks[]
 */

// Implementation pending — see design doc before writing code.
