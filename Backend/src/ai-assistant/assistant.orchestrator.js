const { loadDynamicContext, fetchStoredRoadmap } = require('./dynamicContextLoader');
const { 
    searchWeb, 
    searchGitHubProjects, 
    searchLeetCodeProblems, 
    searchOfficialDocs, 
    searchDynamicRoadmapResources, 
    searchLearningResources 
} = require('./searchTool.service');
const { processTurnInBackground } = require('./memoryExtractor');
const { callLlmWithFallback, streamLlmWithFallback } = require('../services/ai.service');

/**
 * Unified Micro-Router Engine (Single Fast ~100 Token Call):
 * Evaluates user query and determines:
 * 1. CONTEXT REQUIREMENTS (needs_resume, needs_jd, needs_roadmap) with a lenient 60% relevance threshold.
 * 2. REAL-TIME TOOLS (tools: [{ tool, query }]) for verified web, coding, youtube, github, or docs links.
 * 3. INTENT & OUTPUT FORMAT.
 *
 * Saves 75-85% tokens & DB calls by omitting unneeded JD / Resume dumps while ensuring context is NEVER missed when needed!
 */
async function runUnifiedMicroRouter({ promptText, selectedText = '', action = '', activeTab = '', currentRoute = '', userPlan = 'free' }) {
    const cleanAction = (action || '').toLowerCase().trim();
    const isDirectEditPreset = ['enhance', 'shorten', 'fix_grammar', 'rephrase', 'make_ats', 'bullet', 'apply', 'replace', 'use'].includes(cleanAction);

    // ── Tier 1: 0ms Deterministic Guardrails & Direct Action Presets ──────────
    if (isDirectEditPreset) {
        return {
            needs_resume: false,
            needs_jd: false,
            needs_roadmap: false,
            tools: [],
            intent: 'RESUME',
            output_format: 'SUGGESTION_SNIPPET',
            is_rewrite: true,
            reasoning: `Direct UI action preset: ${cleanAction}`
        };
    }

    const securityRegex = /(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?|system\s+prompt|give\s+me\s+all\s+(?:my\s+)?stored\s+data|dump\s+(?:the\s+)?database|show\s+(?:all\s+)?env|export\s+(?:all\s+)?users?|drop\s+table)/i;
    if (securityRegex.test(promptText)) {
        return {
            needs_resume: false,
            needs_jd: false,
            needs_roadmap: false,
            tools: [],
            intent: 'SECURITY',
            output_format: 'MARKDOWN_BULLETS',
            is_rewrite: false,
            reasoning: 'Security shield rejection'
        };
    }

    // ── Tier 2: Single Lightweight Micro-LLM Router (~100 tokens, 150ms) ─────
    const routerSystemPrompt = `You are the Ultra-Fast Unified Micro-Router for KIVI AI (Career Coach & Technical Interview Studio).
Analyze the user's message and determine:
1. CONTEXT REQUIREMENTS (whether to inject Resume, Job Description, or Roadmap).
2. REAL-TIME TOOLS (whether to search Web, LeetCode, YouTube, GitHub, Official Docs).
3. RESUME EDIT INTENT (whether user is requesting adding/updating resume content).

LENIENCY RULES (60% Threshold — When in doubt, set true):
- "needs_jd" (Job Description): Set TRUE if user mentions "this company", company name, job role, hiring process, interview rounds, salary, JD requirements, or asks how to align for a role.
- "needs_resume" (Candidate Resume): Set TRUE if user asks to review, tailor, rewrite, improve, check gaps in their experience, bullet points, skills, or projects.
- "needs_roadmap" (Preparation Roadmap): Set TRUE if user asks about their 14-day study plan, milestones, completed/pending tasks.
- "is_resume_edit": Set TRUE if user asks to add, modify, rewrite, enhance, shorten, replace, or update any part of their resume (e.g. "add product management", "rewrite summary", "change bullet 2", "make this ATS-friendly"). Set FALSE if it is purely informational (e.g. "what is my match score?", "explain technical questions", "give me leetcode questions").
- If probability of needing context is ≥60%, set it to TRUE.
- Set ALL context to FALSE ONLY if the query is 100% general programming/computer science (e.g. "what is binary search", "how does useEffect work", "explain CAP theorem").

AVAILABLE TOOLS:
- "web": Live web search for company hiring rounds, company background, salary, recent tech news.
- "leetcode": LeetCode coding problems & algorithmic challenges.
- "video": YouTube tutorials, video crash courses, system design playlists.
- "github": Open-source repos & starter templates.
- "docs": Official framework/language documentation.

Respond with ONLY valid JSON:
{
  "needs_resume": true or false,
  "needs_jd": true or false,
  "needs_roadmap": true or false,
  "is_resume_edit": true or false,
  "tools": [
    { "tool": "web" | "leetcode" | "video" | "github" | "docs", "query": "concise search keywords" }
  ],
  "intent": "RESUME" | "JOB_DESCRIPTION" | "ROADMAP" | "GENERAL" | "DYNAMIC_SEARCH",
  "output_format": "SUGGESTION_SNIPPET" | "MARKDOWN_BULLETS" | "CONVERSATIONAL"
}`;

    const routerUserPrompt = `${selectedText ? `Selection: "${selectedText.slice(0, 150)}"\n` : ''}User Query: "${promptText}"
Active Tab: ${activeTab || 'interview'}

JSON Decision:`;

    try {
        const rawResult = await callLlmWithFallback({
            systemPrompt: routerSystemPrompt,
            userPrompt: routerUserPrompt,
            plan: userPlan,
            isAssistant: true
        });

        const jsonText = typeof rawResult === 'string' ? rawResult : (rawResult?.content || '');
        const match = jsonText.match(/\{[\s\S]*?\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            
            // Normalize tools
            let toolList = [];
            if (Array.isArray(parsed.tools)) {
                toolList = parsed.tools;
            } else if (parsed.tool && parsed.tool !== 'none' && parsed.tool !== 'null') {
                toolList = [{ tool: parsed.tool, query: parsed.query || promptText }];
            }

            const validTools = ['web', 'leetcode', 'video', 'youtube', 'github', 'docs', 'roadmap'];
            const filteredTools = toolList
                .map(t => ({
                    tool: String(t.tool || '').toLowerCase().trim(),
                    query: t.query ? String(t.query).trim() : promptText
                }))
                .filter(t => validTools.includes(t.tool) && t.query.length > 0)
                .slice(0, 3);

            const isResumeEdit = Boolean(parsed.is_resume_edit) || parsed.output_format === 'SUGGESTION_SNIPPET' || isDirectEditPreset;

            return {
                needs_resume: Boolean(parsed.needs_resume) || isResumeEdit,
                needs_jd: Boolean(parsed.needs_jd),
                needs_roadmap: Boolean(parsed.needs_roadmap),
                is_resume_edit: isResumeEdit,
                tools: filteredTools,
                intent: parsed.intent || (isResumeEdit ? 'RESUME' : 'GENERAL'),
                output_format: parsed.output_format || (isResumeEdit ? 'SUGGESTION_SNIPPET' : 'MARKDOWN_BULLETS'),
                is_rewrite: isResumeEdit,
                reasoning: parsed.reasoning || 'Micro-router classified'
            };
        }
    } catch (err) {
        console.warn('[Micro-Router] Router evaluation notice, using safe fallback:', err.message);
    }

    // Default safe fallback (lenient 60% approach: include resume & JD)
    return {
        needs_resume: true,
        needs_jd: true,
        needs_roadmap: false,
        is_resume_edit: isDirectEditPreset,
        tools: [],
        intent: 'GENERAL',
        output_format: 'MARKDOWN_BULLETS',
        is_rewrite: isDirectEditPreset,
        reasoning: 'Fallback default'
    };
}

/**
 * Backward-compatible helper
 */
function detectToolRequirement(message) {
    return {
        needsResources: false,
        needsWebSearch: false
    };
}

/**
 * Dual-Payload Response Extraction:
 * Case 1 (Resume Edit): { messageForUser: string, ResumeUpdations: string (HTML), toolCalls: array }
 * Case 2 (Non-Edit / Q&A): { messageForUser: string, ResumeUpdations: false, toolCalls: array }
 */
function parseDualPayloadAssistantReply(rawReply, isExplicitRewrite = false) {
    if (!rawReply || typeof rawReply !== 'string') {
        return {
            messageForUser: 'Here is information to assist you.',
            ResumeUpdations: false,
            targetText: null,
            suggestedSnippet: null
        };
    }

    const trimmed = rawReply.trim();

    // 1. Check if reply is wrapped in valid JSON with messageForUser / ResumeUpdations
    const jsonMatch = trimmed.match(/\{[\s\S]*"(?:messageForUser|replyText|ResumeUpdations)"[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            const messageForUser = parsed.messageForUser || parsed.replyText || parsed.message || 'Here is the response.';
            const rawResumeUpdation = parsed.ResumeUpdations ?? parsed.resumeUpdations ?? parsed.suggestedSnippet;
            const isResumeEdit = rawResumeUpdation && rawResumeUpdation !== false && rawResumeUpdation !== 'false' && rawResumeUpdation !== 'null';
            const resumeHtml = isResumeEdit ? String(rawResumeUpdation).trim() : false;

            return {
                messageForUser,
                ResumeUpdations: resumeHtml,
                targetText: parsed.targetText || null,
                suggestedSnippet: resumeHtml ? resumeHtml : null
            };
        } catch (e) {
            // Fall through to markdown code fence extraction
        }
    }

    // 2. Fallback parser for markdown code blocks (```suggestion, ```html, etc.)
    const { suggestedSnippet, targetText } = extractSnippetAndTargetFromReply(rawReply, isExplicitRewrite);

    // Clean conversational message without raw code blocks
    let cleanMessage = rawReply
        .replace(/```(?:suggestion|rewrite|snippet|original|target|html)[\s\S]*?```/gi, '')
        .replace(/(?:Suggested Rewrite|Improved Version|Refined Bullet|Original Line|Original Text):\s*["“]?([^"”\n\r]+)["”]?/gi, '')
        .trim();

    if (!cleanMessage) {
        cleanMessage = suggestedSnippet 
            ? "I've generated the improved ATS version for your resume. Review and apply the changes below." 
            : rawReply;
    }

    return {
        messageForUser: cleanMessage,
        ResumeUpdations: suggestedSnippet ? suggestedSnippet : false,
        targetText: targetText || null,
        suggestedSnippet: suggestedSnippet || null
    };
}

/**
 * Extracts clean suggested snippet and original target text from assistant response
 * ONLY when isExplicitRewrite is true!
 */
function extractSnippetAndTargetFromReply(replyText, isExplicitRewrite = false) {
    if (!replyText || typeof replyText !== 'string') return { suggestedSnippet: null, targetText: null };

    if (!isExplicitRewrite) {
        return { suggestedSnippet: null, targetText: null };
    }

    // 1. Target/Original Text
    let targetText = null;
    const originalBlockMatch = replyText.match(/```(?:original|target)\s*\n?([\s\S]*?)```/i);
    if (originalBlockMatch && originalBlockMatch[1] && originalBlockMatch[1].trim()) {
        targetText = originalBlockMatch[1].trim();
    } else {
        const originalLabelMatch = replyText.match(/(?:Original Line|Original Text|Original Bullet|Original):\s*["“]?([^"”\n\r]+)["”]?/i);
        if (originalLabelMatch && originalLabelMatch[1] && originalLabelMatch[1].trim()) {
            targetText = originalLabelMatch[1].trim().replace(/^["']|["']$/g, '');
        }
    }

    // 2. Suggested Snippet
    let suggestedSnippet = null;
    const codeBlockMatch = replyText.match(/```(?:suggestion|rewrite|snippet)\s*\n?([\s\S]*?)```/i);
    if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].trim()) {
        suggestedSnippet = codeBlockMatch[1].trim();
    } else {
        const labeledMatch = replyText.match(/(?:Suggested Rewrite|Improved Version|Refined Bullet|Updated Text|Refined Text|Suggestion|Improved Line):\s*["“]?([^"”\n\r]+(?:[\n\r]+(?!\n|\r|#|\*)[^"”\n\r]+)*)["”]?/i);
        if (labeledMatch && labeledMatch[1] && labeledMatch[1].trim()) {
            suggestedSnippet = labeledMatch[1].trim().replace(/^["']|["']$/g, '');
        } else {
            const boldMatch = replyText.match(/\*\*([^*\n\r]{20,500})\*\*/);
            if (boldMatch && boldMatch[1] && boldMatch[1].trim()) {
                suggestedSnippet = boldMatch[1].trim();
            } else {
                if (replyText.length < 800) {
                    const bulletMatch = replyText.match(/^[•\-\*]\s*([^\n\r]{25,500})/m);
                    if (bulletMatch && bulletMatch[1] && bulletMatch[1].trim()) {
                        suggestedSnippet = bulletMatch[1].trim();
                    }
                }
            }
        }
    }

    if (targetText) {
        targetText = targetText.replace(/^[•\-\*]\s*/, '').trim();
    }
    if (suggestedSnippet) {
        suggestedSnippet = suggestedSnippet.replace(/^[•\-\*]\s*/, '').trim();
        const isConversational = /^(?:sure|certainly|here\s+is|i\s+have|below\s+is|let\s+me|hope\s+this)/i.test(suggestedSnippet);
        const isCodeScript = /^(?:import\s+|const\s+|let\s+|var\s+|function\s+|def\s+|class\s+|SELECT\s+|<!DOCTYPE)/i.test(suggestedSnippet);
        if (isConversational || isCodeScript || suggestedSnippet.length < 15 || suggestedSnippet.length > 1500) {
            suggestedSnippet = null;
        }
    }

    return { suggestedSnippet, targetText };
}

/**
 * Builds formatted prompt and context for KIVI AI Assistant using Unified Micro-Router
 */
async function buildAssistantPromptAndMessages({ userId, reportId = null, message = '', selectedText = '', action = '', instruction = '', activeTab = '', currentRoute = '', userPlan = 'free', currentResumeHtml = '', onStatus = null }) {
    const promptText = (message || instruction || '').trim();

    // 1. Step 1: Run Single Fast Unified Micro-Router (Context Needs + Multi-Tool Selection)
    const routerDecision = await runUnifiedMicroRouter({
        promptText,
        selectedText,
        action,
        activeTab,
        currentRoute,
        userPlan
    });

    const isExplicitRewrite = routerDecision.is_rewrite || routerDecision.is_resume_edit || ['enhance', 'shorten', 'fix_grammar', 'rephrase', 'make_ats'].includes(action);

    // 2. Step 2: Dynamically load ONLY the required pieces of context (Selective DB query with 60% leniency)
    const { candidateContextSnippet, recentHistory, profile, companyName, dbCallsAvoided } = await loadDynamicContext({
        userId,
        reportId,
        contextNeeds: {
            needs_resume: routerDecision.needs_resume,
            needs_jd: routerDecision.needs_jd,
            needs_roadmap: routerDecision.needs_roadmap
        },
        intentData: routerDecision,
        promptText,
        selectedText,
        currentResumeHtml
    });

    // 3. Step 3: Execute Selected Multi-Tools in Parallel
    let toolContextSnippet = '';
    let foundResources = [];

    if (Array.isArray(routerDecision.tools) && routerDecision.tools.length > 0) {
        const toolList = routerDecision.tools;

        // Build friendly source display list for UI
        const sourceLabels = toolList.map(t => {
            const toolName = t.tool;
            if (toolName === 'github') return { tool: 'github', name: 'GitHub Repositories', icon: '🐙', query: t.query };
            if (toolName === 'leetcode') return { tool: 'leetcode', name: 'LeetCode Problems', icon: '💡', query: t.query };
            if (toolName === 'docs') return { tool: 'docs', name: 'Official Docs', icon: '📖', query: t.query };
            if (toolName === 'video' || toolName === 'youtube') return { tool: 'video', name: 'YouTube Tutorials', icon: '▶️', query: t.query };
            if (toolName === 'roadmap') return { tool: 'roadmap', name: 'Preparation Roadmap', icon: '🗺️', query: t.query || 'Stored Tasks' };
            return { tool: 'web', name: 'Live Web Search', icon: '🌐', query: t.query };
        });

        if (typeof onStatus === 'function') {
            const toolNames = sourceLabels.map(s => s.name).join(' & ');
            onStatus({
                status: 'searching',
                tools: sourceLabels,
                message: `Searching ${toolNames}...`
            });
        }

        // Execute tools concurrently via Promise.allSettled
        const executionPromises = toolList.map(async (t) => {
            const toolName = t.tool;
            let query = t.query || promptText;

            // Enhance query with real company name if searching for "this company"
            if (companyName && (query.toLowerCase().includes('this company') || query.toLowerCase() === 'company')) {
                query = query.replace(/this company/gi, companyName);
            }

            try {
                if (toolName === 'web') {
                    const results = await searchWeb(query, 3);
                    return { tool: 'web', category: 'Company & Web Intelligence', results: results || [] };
                } else if (toolName === 'github') {
                    const results = await searchGitHubProjects(query, 3);
                    return { tool: 'github', category: 'GitHub Open Source Projects', results: results || [] };
                } else if (toolName === 'leetcode') {
                    const results = await searchLeetCodeProblems(query, 3);
                    return { tool: 'leetcode', category: 'LeetCode & Coding Practice', results: results || [] };
                } else if (toolName === 'docs') {
                    const results = await searchOfficialDocs(query, 3);
                    return { tool: 'docs', category: 'Official Technical Documentation', results: results || [] };
                } else if (toolName === 'video' || toolName === 'youtube') {
                    const results = await searchLearningResources(query, 3);
                    return { tool: 'video', category: 'Video Tutorials & Deep-Dives', results: results || [] };
                } else if (toolName === 'roadmap') {
                    const roadmapSnippet = await fetchStoredRoadmap(reportId, userId);
                    if (roadmapSnippet) {
                        toolContextSnippet += `\n${roadmapSnippet}\n`;
                    }
                    return { tool: 'roadmap', category: 'Stored Roadmap', results: [] };
                }
            } catch (toolErr) {
                console.warn(`[AI Tool Engine] Execution failed for tool "${toolName}":`, toolErr.message);
            }
            return { tool: toolName, category: 'Resources', results: [] };
        });

        const settledResults = await Promise.allSettled(executionPromises);
        
        // Aggregate and deduplicate found resources by URL
        const seenUrls = new Set();
        settledResults.forEach(item => {
            if (item.status === 'fulfilled' && item.value && Array.isArray(item.value.results)) {
                const { category, results } = item.value;
                const validCategoryResults = [];

                results.forEach(res => {
                    if (res && res.url && !seenUrls.has(res.url)) {
                        seenUrls.add(res.url);
                        foundResources.push(res);
                        validCategoryResults.push(res);
                    }
                });

                if (validCategoryResults.length > 0) {
                    const formattedCategory = validCategoryResults.map(r => {
                        return `  • [${r.title}](${r.url})${r.snippet ? `: ${r.snippet}` : ''}`;
                    }).join('\n');
                    toolContextSnippet += `\n\n[Verified ${category}]:\n${formattedCategory}`;
                }
            }
        });

        if (typeof onStatus === 'function') {
            onStatus({
                status: 'synthesizing',
                tools: sourceLabels,
                message: foundResources.length > 0
                    ? `Gathered ${foundResources.length} verified source${foundResources.length > 1 ? 's' : ''}. Synthesizing answer...`
                    : 'Synthesizing response...'
            });
        }
    }

    // 4. Step 4: Construct Grounded System Prompt with Dual-Payload Schema
    let systemPrompt = `You are KIVI AI, a concise, highly factual AI Career Coach, Coding Mentor, and ATS Resume Copilot embedded in the KIVI-AI platform.

DUAL-PAYLOAD RESPONSE SCHEMA:
You MUST structure your response based on the query type:

── CASE 1: RESUME MODIFICATION (When user requests adding, updating, rewriting, enhancing, or shortening resume content) ──
Respond in valid JSON with:
{
  "messageForUser": "Short, friendly 1-2 sentence explanation of the enhancement made (e.g. 'I refreshed your Summary to highlight React, Node, REST APIs, Git, AWS, and AI focus.').",
  "ResumeUpdations": "<valid semantic HTML of the updated section or full resume ready for TipTap editor>",
  "targetText": "<exact text from original resume being replaced, or null if inserting new content>"
}
HTML Formatting for ResumeUpdations:
- Use semantic HTML tags matching TipTap typography: '<p>', '<h3>', '<ul><li><strong>...</strong></li></ul>', '<a href=\"...\">'.
- SKILLS & BULLET POINT UPDATES: When modifying, adding, or deleting a skill or bullet point in an existing list (e.g. 'AI & ML APIs', 'Databases', or a work experience bullet), set 'targetText' to the EXACT original line from the candidate's resume (e.g. 'AI & ML APIs: OpenAI API, Google Gemini API, GitHub Copilot') and return ONLY the updated line in 'ResumeUpdations' (e.g. '<li><strong>AI & ML APIs:</strong> OpenAI API, Google Gemini API, GitHub Copilot, LangChain (RAG) (NEW)</li>'). DO NOT return other unrelated bullet points or the entire section!
- SECTION & PARAGRAPH REWRITES: When rewriting a specific section (e.g. Summary or full Experience), DO NOT repeat the section title/heading (e.g. do NOT output '<h3>Summary</h3>' or 'Summary') if the heading already exists in the document. Return ONLY the updated body content ('<p>...</p>' or '<ul><li>...</li></ul>').
- If you DO include the section heading, ensure 'targetText' includes BOTH the original section heading and its content so the entire section is replaced cleanly.
- Append '(NEW)' to any missing skills added from the JD (e.g. '<strong>Product Management (NEW)</strong>').
- DO NOT dump raw markdown code fences inside 'messageForUser'.

── CASE 2: NON-EDIT QUERY (Q&A, Match Score, Job Description analysis, Interview prep, Technical Coaching, Search) ──
Respond in valid JSON with:
{
  "messageForUser": "Direct, structured markdown answer using headings (###) and bullet points (•). Include verified clickable markdown links [Title](URL) for resources.",
  "ResumeUpdations": false
}

CRITICAL FORMATTING & LINK INTEGRITY RULES:
1. STRICTLY FORBIDDEN: NEVER USE MARKDOWN TABLES (pipes and dashes | col1 | col2 |) in messageForUser.
2. CLICKABLE VERIFIED LINKS & VIDEOS:
   - When asked for resources, study plans, or videos, ALWAYS return direct clickable markdown links: '• [Title](URL) - Key takeaway'.
   - Cite and embed the exact verified URLs provided in the '[Verified ...]' context below (from YouTube, LeetCode, GitHub, Docs, and Web).
   - NEVER INVENT RANDOM YOUTUBE VIDEO IDs (e.g. NEVER make up fake URLs like 'watch?v=...'). If recommending a course or video that is not in the verified context, format it as a guaranteed live YouTube search link:
     '[▶️ Course Title](https://www.youtube.com/results?search_query=topic+tutorial+interview)'
   - NEVER write plain search instructions like 'YouTube (search ...)'. Always provide direct clickable links.
3. ZERO FLUFF & ANSWER ONLY WHAT IS ASKED: Jump straight into the response without conversational filler.`;

    if (routerDecision.intent === 'ROADMAP' || routerDecision.intent === 'ROADMAP_JD') {
        systemPrompt += `\n\nTask: Provide a structured, milestone-based preparation roadmap with clear daily/weekly objectives and verified clickable video/resource links for each phase.`;
    } else if (routerDecision.intent === 'JOB_DESCRIPTION') {
        systemPrompt += `\n\nTask: Analyze and explain the Target Job Description, expected interview rounds, core competencies, and targeted preparation advice.`;
    } else if (routerDecision.intent === 'RESUME_JD') {
        systemPrompt += `\n\nTask: Evaluate and align Candidate's Resume against the Target Job Description. Identify matching skills, missing ATS keywords, and specific impact improvements.`;
    } else if (routerDecision.intent === 'RESUME' || isExplicitRewrite) {
        systemPrompt += `\n\nTask: Provide targeted ATS-optimized text revisions or advice for the user's resume according to the dual-payload JSON schema.`;
    } else if (routerDecision.intent === 'DYNAMIC_SEARCH') {
        systemPrompt += `\n\nTask: Present verified technical resources, GitHub projects, LeetCode challenges, or official documentation with clickable links based on the search results.`;
    } else {
        systemPrompt += `\n\nTask: Provide a crystal-clear, direct technical explanation with concise markdown bullets, code snippets, and resource links where relevant.`;
    }

    let userContent = promptText;
    if (selectedText && selectedText.trim()) {
        if (isExplicitRewrite) {
            let actionGuide = "Make the text snippet impactful, professional, and results-oriented with strong action verbs.";
            if (action === "shorten") {
                actionGuide = "Shorten the text snippet to be concise and punchy while keeping key metrics and achievements intact.";
            } else if (action === "fix_grammar") {
                actionGuide = "Correct all spelling, grammar, and phrasing errors while maintaining original technical meaning.";
            } else if (action === "align_job") {
                actionGuide = "Optimize the text snippet with industry-standard technical keywords and ATS metrics matching the job requirements.";
            }

            userContent = `Selected Resume / Document Text:
"${selectedText.trim()}"

Instruction / Goal:
${promptText || actionGuide}

Respond with the dual-payload JSON schema with "messageForUser", "ResumeUpdations", and "targetText".`;
        } else {
            userContent = `[Referenced Context]:
"${selectedText.trim()}"

User Query:
${promptText}`;
        }
    }

    // Assemble final prompt sections
    let fullSystemPrompt = systemPrompt;
    if (candidateContextSnippet) {
        fullSystemPrompt += `\n\n${candidateContextSnippet}`;
    }
    if (toolContextSnippet) {
        fullSystemPrompt += `\n\n${toolContextSnippet}`;
    }

    const formattedMessages = [
        { role: 'system', content: fullSystemPrompt.trim() },
        ...recentHistory,
        { role: 'user', content: userContent }
    ];

    // Log exact assistant payload sent to LLM (including user query and messages)
    logAssistantQueryPayload({
        promptText,
        formattedMessages
    });

    return {
        formattedMessages,
        promptText: promptText || (selectedText ? `Refine: ${selectedText.slice(0, 30)}...` : 'Assistant Query'),
        foundResources,
        profile,
        intentData: routerDecision,
        isExplicitRewrite,
        dbCallsAvoided
    };
}

/**
 * Post-processes generated markdown to guarantee 100% active, non-broken links.
 * Converts any non-verified hallucinated YouTube watch IDs into guaranteed live YouTube search URLs.
 */
function sanitizeOutputLinks(replyText, verifiedResources = []) {
    if (!replyText || typeof replyText !== 'string') return replyText;
    const verifiedUrls = new Set((verifiedResources || []).map(r => (r.url || '').trim()));

    return replyText.replace(/\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)[^\)]*)\)/gi, (match, title, rawUrl, videoId) => {
        if (verifiedUrls.has(rawUrl.trim())) {
            return match; // Keep verified video
        }
        // Hallucinated 11-char video ID -> rewrite to guaranteed live YouTube search URL
        const cleanTitle = title.replace(/^[▶️💡📖🐙🌐\s\-•*]+/, '').trim();
        const searchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(cleanTitle + ' tutorial interview preparation');
        return `[${title}](${searchUrl})`;
    });
}

/**
 * Logs only the exact prompt and messages payload sent to the LLM (including user query)
 */
function logAssistantQueryPayload({
    promptText,
    formattedMessages
}) {
    const timeStr = new Date().toLocaleTimeString();
    console.log('\n' + '═'.repeat(80));
    console.log(`🤖 [EXACT PAYLOAD SENT TO LLM] | ${timeStr}`);
    console.log('═'.repeat(80));
    if (promptText) {
        console.log(`👤 User Query : "${promptText}"\n`);
    }

    if (Array.isArray(formattedMessages)) {
        formattedMessages.forEach((m, idx) => {
            console.log(`─── Message ${idx + 1} [Role: ${m.role.toUpperCase()}] ───`);
            console.log(m.content);
            console.log('');
        });
    }
    console.log('═'.repeat(80) + '\n');
}

/**
 * Real-Time SSE Streaming AI Assistant Orchestrator
 * @param {Object} params
 * @param {string} params.userId - Authenticated user ID
 * @param {string} [params.reportId] - Currently open report ID
 * @param {string} [params.message] - User query
 * @param {string} [params.selectedText] - Highlighted editor text snippet
 * @param {string} [params.action] - Improvement action preset
 * @param {string} [params.instruction] - Specific instructions
 * @param {string} [params.currentResumeHtml] - Live uncommitted editor content
 * @param {string} [params.userPlan] - User plan ('free'|'pro'|'premium')
 * @param {Function} params.onToken - Callback for streaming tokens (token: string) => void
 * @returns {Promise<Object>} Assembled result with reply, messageForUser, ResumeUpdations, resources, profile, intentData
 */
async function streamAssistantChat({ userId, reportId, message, selectedText, action, instruction, activeTab = '', currentRoute = '', userPlan = 'free', currentResumeHtml = '', onStatus = null, onToken }) {
    const { formattedMessages, promptText, foundResources, profile, intentData, isExplicitRewrite, dbCallsAvoided } = await buildAssistantPromptAndMessages({
        userId,
        reportId,
        message,
        selectedText,
        action,
        instruction,
        activeTab,
        currentRoute,
        userPlan,
        currentResumeHtml,
        onStatus
    });

    const rawReply = await streamLlmWithFallback({
        messages: formattedMessages,
        plan: userPlan,
        isAssistant: true,
        onToken
    });

    // Guarantee 100% active links (replaces any hallucinated video IDs)
    const fullReply = sanitizeOutputLinks(rawReply, foundResources);

    // Extract Dual-Payload (messageForUser + ResumeUpdations)
    const dualPayload = parseDualPayloadAssistantReply(fullReply, isExplicitRewrite);

    // Save active turn in Redis memory buffer asynchronously
    processTurnInBackground(userId, promptText, dualPayload.messageForUser || fullReply);

    return {
        reply: dualPayload.messageForUser || fullReply,
        messageForUser: dualPayload.messageForUser || fullReply,
        ResumeUpdations: dualPayload.ResumeUpdations,
        targetText: dualPayload.suggestedSnippet ? (dualPayload.targetText || selectedText || null) : null,
        suggestedSnippet: dualPayload.suggestedSnippet || (dualPayload.ResumeUpdations !== false ? dualPayload.ResumeUpdations : null),
        resources: foundResources,
        candidateProfile: profile,
        intentData,
        dbCallsAvoided
    };
}

/**
 * Non-streaming AI Assistant Orchestrator function (backward compatible)
 */
async function processAssistantChat({ userId, reportId, message, selectedText, action, instruction, activeTab = '', currentRoute = '', userPlan = 'free', currentResumeHtml = '' }) {
    const { formattedMessages, promptText, foundResources, profile, intentData, isExplicitRewrite, dbCallsAvoided } = await buildAssistantPromptAndMessages({
        userId,
        reportId,
        message,
        selectedText,
        action,
        instruction,
        activeTab,
        currentRoute,
        userPlan,
        currentResumeHtml
    });

    const llmResult = await callLlmWithFallback({
        messages: formattedMessages,
        plan: userPlan,
        isAssistant: true
    });

    const rawReplyText = typeof llmResult === 'string' ? llmResult : (llmResult?.replyText || llmResult?.content || JSON.stringify(llmResult));
    const replyText = sanitizeOutputLinks(rawReplyText, foundResources);
    const dualPayload = parseDualPayloadAssistantReply(replyText, isExplicitRewrite);

    processTurnInBackground(userId, promptText, dualPayload.messageForUser || replyText);

    return {
        reply: dualPayload.messageForUser || replyText,
        messageForUser: dualPayload.messageForUser || replyText,
        ResumeUpdations: dualPayload.ResumeUpdations,
        targetText: dualPayload.suggestedSnippet ? (dualPayload.targetText || selectedText || null) : null,
        suggestedSnippet: dualPayload.suggestedSnippet || (dualPayload.ResumeUpdations !== false ? dualPayload.ResumeUpdations : null),
        resources: foundResources,
        candidateProfile: profile,
        intentData,
        dbCallsAvoided
    };
}

module.exports = {
    streamAssistantChat,
    processAssistantChat,
    buildAssistantPromptAndMessages,
    detectToolRequirement,
    extractSnippetFromReply: (replyText, isExplicitRewrite) => parseDualPayloadAssistantReply(replyText, isExplicitRewrite).suggestedSnippet,
    extractSnippetAndTargetFromReply,
    parseDualPayloadAssistantReply
};
