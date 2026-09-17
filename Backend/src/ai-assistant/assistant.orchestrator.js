const { classifyIntent } = require('./intentClassifier');
const { loadDynamicContext } = require('./dynamicContextLoader');
const { searchWeb, searchLearningResources, searchDynamicRoadmapResources } = require('./searchTool.service');
const { processTurnInBackground } = require('./memoryExtractor');
const { callLlmWithFallback, streamLlmWithFallback } = require('../services/ai.service');

/**
 * Heuristic to detect if query explicitly asks for external tutorials or live web search
 */
function detectToolRequirement(message) {
    const text = (message || '').toLowerCase();
    
    // Only trigger external tool searches when explicitly requested by user
    const isResourceQuery = text.includes('youtube') || 
                           text.includes('video tutorial') || 
                           text.includes('video links') || 
                           text.includes('course recommendation') || 
                           text.includes('where to study online') || 
                           text.includes('best youtube channel');

    const isLiveSearchQuery = text.includes('latest in 2025') || 
                             text.includes('latest in 2026') || 
                             text.includes('current market trend') || 
                             text.includes('salary benchmark');

    return {
        needsResources: isResourceQuery,
        needsWebSearch: isLiveSearchQuery
    };
}

/**
 * Extracts clean suggested snippet and original target text from assistant response
 * ONLY when isExplicitRewrite is true!
 */
function extractSnippetAndTargetFromReply(replyText, isExplicitRewrite = false) {
    if (!replyText || typeof replyText !== 'string') return { suggestedSnippet: null, targetText: null };

    // Strict boundary: If query was NOT an explicit in-place rewrite request, NEVER produce a suggestedSnippet!
    // This prevents general resume advice, interview Q&A, coding snippets, and study roadmaps from showing an Apply button.
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

    // Pattern A: Code block with suggestion / rewrite / snippet
    const codeBlockMatch = replyText.match(/```(?:suggestion|rewrite|snippet)\s*\n?([\s\S]*?)```/i);
    if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].trim()) {
        suggestedSnippet = codeBlockMatch[1].trim();
    } else {
        // Pattern B: Labeled text
        const labeledMatch = replyText.match(/(?:Suggested Rewrite|Improved Version|Refined Bullet|Updated Text|Refined Text|Suggestion|Improved Line):\s*["“]?([^"”\n\r]+(?:[\n\r]+(?!\n|\r|#|\*)[^"”\n\r]+)*)["”]?/i);
        if (labeledMatch && labeledMatch[1] && labeledMatch[1].trim()) {
            suggestedSnippet = labeledMatch[1].trim().replace(/^["']|["']$/g, '');
        } else {
            // Pattern C: Bold text line (e.g. **Architected high-throughput REST API...**)
            const boldMatch = replyText.match(/\*\*([^*\n\r]{20,500})\*\*/);
            if (boldMatch && boldMatch[1] && boldMatch[1].trim()) {
                suggestedSnippet = boldMatch[1].trim();
            } else {
                // Pattern D: Single bullet in a short response (< 800 chars)
                if (replyText.length < 800) {
                    const bulletMatch = replyText.match(/^[•\-\*]\s*([^\n\r]{25,500})/m);
                    if (bulletMatch && bulletMatch[1] && bulletMatch[1].trim()) {
                        suggestedSnippet = bulletMatch[1].trim();
                    }
                }
            }
        }
    }

    // Strip leading list bullet markers if present so they match ProseMirror text nodes cleanly
    if (targetText) {
        targetText = targetText.replace(/^[•\-\*]\s*/, '').trim();
    }
    if (suggestedSnippet) {
        suggestedSnippet = suggestedSnippet.replace(/^[•\-\*]\s*/, '').trim();

        // Sanity check: Reject snippets that are conversational filler, entire code scripts, or too long
        const isConversational = /^(?:sure|certainly|here\s+is|i\s+have|below\s+is|let\s+me|hope\s+this)/i.test(suggestedSnippet);
        const isCodeScript = /^(?:import\s+|const\s+|let\s+|var\s+|function\s+|def\s+|class\s+|SELECT\s+|<!DOCTYPE)/i.test(suggestedSnippet);
        if (isConversational || isCodeScript || suggestedSnippet.length < 15 || suggestedSnippet.length > 1500) {
            suggestedSnippet = null;
        }
    }

    return { suggestedSnippet, targetText };
}

/**
 * Builds formatted prompt and context for KIVI AI Assistant using Smart Intent & Dynamic Context Loading
 */
async function buildAssistantPromptAndMessages({ userId, reportId = null, message = '', selectedText = '', action = '', instruction = '', activeTab = '', currentRoute = '', userPlan = 'free' }) {
    const promptText = (message || instruction || '').trim();

    // 1. Step 1: Classify Query Intent (0ms Tier 1 with Tier 2 fallback)
    const intentData = await classifyIntent({
        message: promptText,
        selectedText,
        action,
        activeTab,
        currentRoute,
        plan: userPlan
    });

    // 2. Step 2: Dynamically load ONLY the required pieces of context (with Semantic Vector Search for Resume, Roadmap, JD)
    const { candidateContextSnippet, recentHistory, profile, dbCallsAvoided } = await loadDynamicContext({
        userId,
        reportId,
        intentData,
        promptText,
        selectedText
    });

    // 3. Step 3: Evaluate Tool Requirements (Dynamic Search / Learning Resources / GitHub / LeetCode / Docs)
    const toolFlags = detectToolRequirement(promptText);
    let toolContextSnippet = '';
    let foundResources = [];

    const wantsSearch = intentData.web_search || toolFlags.needsResources || toolFlags.needsWebSearch;

    if (wantsSearch) {
        const topic = intentData.extracted_topic || promptText.replace(/give me|tutorials?|videos?|links?|resources?|how to learn|study material|roadmap|according|find|karo/gi, '').trim() || 'Software Engineering';
        const searchTypes = (Array.isArray(intentData.search_strategy) && intentData.search_strategy.length > 0)
            ? intentData.search_strategy
            : ['docs', 'github', 'tutorials'];

        foundResources = await searchDynamicRoadmapResources({
            topic,
            searchTypes,
            maxResults: 4
        });

        if (foundResources.length > 0) {
            toolContextSnippet += `\n[Verified Learning & Practice Resources Found]:\n` + 
                foundResources.map((r, i) => `${i + 1}. [${r.title}](${r.url}) - ${r.snippet || ''}`).join('\n') + '\n';
        }
    }

    // 4. Step 4: Construct Strict Grounded System Prompt (Zero Hallucinations & Zero Fluff)
    let systemPrompt = `You are KIVI AI, a concise, highly factual AI Career Coach, Coding Mentor, and ATS Resume Copilot embedded in the KIVI-AI platform.

CRITICAL ANTI-HALLUCINATION & CONCISENESS RULES:
1. ANSWER ONLY WHAT IS ASKED: Do NOT provide unrequested sections, unsolicited document outlines, generic summaries, or conversational filler (e.g. "Sure!", "Certainly!", "Here is the information"). Jump straight into the direct answer.
2. ZERO HALLUCINATION: Do NOT invent fictional personas, artificial metrics (e.g. SUS scores), fake project details, or essay templates.
3. GROUNDED RETRIEVAL: When the user asks for their roadmap, interview score, or candidate data, use ONLY the exact data provided in the context below. If data is not provided, state that clearly in one brief sentence.
4. CLEAN MARKDOWN: Format with neat headings and bullet points. Never use raw HTML.`;

    const isExplicitResumeAction = ['enhance', 'shorten', 'fix_grammar', 'align_job', 'rephrase', 'make_ats', 'apply', 'add', 'insert'].includes(action);
    const hasApplyVerbInMsg = /(?:apply|add|put|insert|incorporate|include|integrate|update|change|modify|fix)/i.test(promptText);
    const hasSelectedText = Boolean(selectedText && selectedText.trim());
    const isExplicitRewrite = (intentData.intent === 'RESUME' || intentData.intent === 'RESUME_EDIT') &&
        (Boolean(intentData.output_format === 'SUGGESTION_SNIPPET') || isExplicitResumeAction || hasApplyVerbInMsg || (hasSelectedText && intentData.is_rewrite !== false));

    // Intent-specific instructions for maximum token efficiency and clean formatting
    if (intentData.intent === 'ROADMAP' || intentData.intent === 'ROADMAP_RESOURCES') {
        systemPrompt += `\n\nTask: Provide expert Technical Learning Roadmap guidance.
Guidelines:
- Reference the user's Stored 14-Day Preparation Roadmap from context (days, milestone topics, and tasks).
- Recommend high-value practice resources: GitHub repositories, LeetCode / problem-solving practice, and official documentation.
- The stored roadmap plan is fixed — do NOT rewrite, modify, or output replacement code blocks for the roadmap document.`;
    } else if (intentData.intent === 'JOB_DESCRIPTION') {
        systemPrompt += `\n\nTask: Analyze and explain the Target Job Description provided in context.
Guidelines:
- Ground your analysis in the exact Target Job Description provided in the context below.
- Highlight core technical qualifications, expected daily responsibilities, must-have vs nice-to-have skills, and potential interview focus areas.`;
    } else if (intentData.intent === 'RESUME_JD') {
        systemPrompt += `\n\nTask: Evaluate and align Candidate's Resume against the Target Job Description.
Guidelines:
- Compare candidate's resume projects and experience directly with the Target Job Description requirements.
- Identify matching skills, missing ATS keywords, and specific impact improvements to increase candidate's job match.`;
    } else if (intentData.intent === 'ROADMAP_JD') {
        systemPrompt += `\n\nTask: Map the Target Job Description requirements against the 14-Day Preparation Roadmap.
Guidelines:
- Correlate each core JD requirement to the corresponding day(s) in the candidate's preparation roadmap.
- Provide targeted learning and practice resources for any requirements that need extra reinforcement.`;
    } else if (intentData.intent === 'RESUME_ROADMAP') {
        systemPrompt += `\n\nTask: Guide candidate's preparation by connecting their Resume experience with the 14-Day Roadmap.
Guidelines:
- Identify which roadmap topics build on the candidate's existing resume strengths vs which address their gaps.
- Prioritize roadmap practice areas to maximize preparation efficiency.`;
    } else if (intentData.intent === 'ALL_THREE') {
        systemPrompt += `\n\nTask: Provide a Holistic Interview Readiness Evaluation across Resume, Job Description, and Roadmap.
Guidelines:
- Assess how well the Candidate's Resume matches the Target Job Description.
- Outline how the 14-Day Preparation Roadmap systematically bridges the identified skill gaps.`;
    } else if (intentData.intent === 'DYNAMIC_SEARCH') {
        systemPrompt += `\n\nTask: Present verified technical resources, GitHub projects, LeetCode challenges, or official documentation based on the query.`;
    } else if (intentData.intent === 'RESUME' || intentData.intent === 'RESUME_EDIT') {
        if (isExplicitRewrite) {
            systemPrompt += `\n\nTask: Provide targeted ATS-optimized text revisions for the user's resume.

CRITICAL DOCUMENT REWRITE RULES (STRICT COMPLIANCE REQUIRED):
1. NEVER output the user's full resume document, full header, or complete resume template. Outputting the entire resume in chat text is STRICTLY FORBIDDEN.
2. Output ONLY the specific line, bullet point, or skills section being added or updated.
3. When updating an existing line or adding skills/keywords to a section:
   - Wrap the EXACT original text as it currently appears in candidate context inside \`\`\`original ... \`\`\`
   - Wrap ONLY the exact improved replacement snippet inside \`\`\`suggestion ... \`\`\`
4. When adding skills to an existing Technical Skills or Summary section:
   - Identify the existing skills/summary line from candidate context and put it in \`\`\`original ... \`\`\`.
   - Put the updated skills/summary line containing the new skills inside \`\`\`suggestion ... \`\`\`.
5. Keep conversational commentary to 1 brief sentence maximum outside the code blocks so the UI can present an Apply button.`;
        } else {
            systemPrompt += `\n\nTask: Provide resume advice and actionable recommendations.
Guidelines:
- Provide structured, practical feedback and bullet point suggestions in standard markdown.
- CRITICAL: Do NOT wrap text in \`\`\`suggestion ... \`\`\` code blocks and do NOT attempt to rewrite/replace the active document unless the user explicitly requested a direct document text rewrite.`;
        }
    } else if (intentData.intent === 'INTERVIEW_REPORT') {
        systemPrompt += `\n\nTask: Analyze candidate's interview metrics, readiness score, and skill gaps from context.`;
    } else if (intentData.intent === 'JOB_SEARCH') {
        systemPrompt += `\n\nTask: Provide targeted job recommendations based on candidate's verified skills.`;
    } else if (intentData.intent === 'PROJECT') {
        systemPrompt += `\n\nTask: Explain the candidate's portfolio projects from context.`;
    } else if (intentData.intent === 'SKILLS') {
        systemPrompt += `\n\nTask: Overview candidate's profile skills from context.`;
    } else if (intentData.intent === 'TECH_CONCEPT' || intentData.intent === 'GENERAL') {
        systemPrompt += `\n\nTask: Provide a direct, crystal-clear technical explanation with concise markdown bullets and code snippets where relevant. Do NOT format as a resume bullet point.`;
    } else if (intentData.intent === 'PLATFORM_HELP') {
        systemPrompt += `\n\nTask: Provide brief, step-by-step guidance on KIVI-AI platform features.`;
    } else {
        systemPrompt += `\n\nTask: Provide direct, actionable career guidance.`;
    }

    // Add length guidance
    if (intentData.response_length === 'CONCISE') {
        systemPrompt += `\nKeep your response compact and punchy (1-2 short paragraphs or 3-4 bullet points maximum).`;
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

Please provide your improvement and wrap the exact suggested replacement text in a markdown code block tagged \`\`\`suggestion ... \`\`\` so it can be applied directly to the document.`;
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

    // Log exact assistant payload sent to LLM
    logAssistantQueryPayload({
        promptText,
        selectedText,
        action,
        intentData,
        candidateContextSnippet,
        toolContextSnippet,
        recentHistory,
        formattedMessages,
        userPlan
    });

    return {
        formattedMessages,
        promptText: promptText || (selectedText ? `Refine: ${selectedText.slice(0, 30)}...` : 'Assistant Query'),
        foundResources,
        profile,
        intentData,
        isExplicitRewrite,
        dbCallsAvoided
    };
}

/**
 * Pretty-prints complete assistant query payload to terminal for debugging and inspection
 */
function logAssistantQueryPayload({
    promptText,
    selectedText,
    action,
    intentData,
    candidateContextSnippet,
    toolContextSnippet,
    recentHistory,
    formattedMessages,
    userPlan
}) {
    const timeStr = new Date().toLocaleTimeString();
    console.log('\n' + '═'.repeat(85));
    console.log(`🤖 [KIVI AI ASSISTANT REQUEST PAYLOAD] | ${timeStr}`);
    console.log('═'.repeat(85));
    console.log(`👤 User Query       : "${promptText || '(empty)'}"`);
    console.log(`📌 Highlighted Text : ${selectedText ? `"${selectedText.trim()}"` : 'None (No mouse selection)'}`);
    console.log(`🎯 Action Preset    : ${action || 'None'}`);
    console.log(`💳 User Plan        : ${userPlan || 'free'}`);
    console.log(`🧠 Intent Classified: ${intentData?.intent} (Output Format: ${intentData?.output_format || 'N/A'}, Target: ${intentData?.target || 'GENERAL'}, Keys: [${(intentData?.context_keys || []).join(', ')}])`);

    console.log('\n📦 [CONTEXT INJECTED WITH QUERY]:');
    if (candidateContextSnippet) {
        const hasResume = candidateContextSnippet.includes("[Candidate's Active Resume Document Structure]");
        const hasJd = candidateContextSnippet.includes('[Target Job Description & Role Specifications]');
        const hasRoadmap = candidateContextSnippet.includes('[14-Day Structured Preparation Roadmap');
        const hasProfile = candidateContextSnippet.includes('[Candidate Profile]');
        const hasHighlights = candidateContextSnippet.includes('[Highlight');

        console.log(`  • Resume Injected  : ${hasResume ? '✅ YES' : '❌ NO'}`);
        console.log(`  • Job Desc Injected: ${hasJd ? '✅ YES' : '❌ NO'}`);
        console.log(`  • Roadmap Injected : ${hasRoadmap ? '✅ YES' : '❌ NO'}`);
        console.log(`  • Profile Injected : ${hasProfile ? '✅ YES' : '❌ NO'}`);
        console.log(`  • RAG Vector Match : ${hasHighlights ? '✅ YES' : '❌ NO'}`);
        console.log('\n--- Injected Context Content ---');
        console.log(candidateContextSnippet.trim());
        console.log('--------------------------------');
    } else {
        console.log('  (No DB context needed — Zero DB call)');
    }

    if (toolContextSnippet) {
        console.log('\n🔧 [TOOL / LEARNING RESOURCES CONTEXT]:');
        console.log(toolContextSnippet.trim());
    }

    if (Array.isArray(recentHistory) && recentHistory.length > 0) {
        console.log(`\n💬 [CONVERSATION HISTORY ATTACHED]: ${recentHistory.length} turns`);
        recentHistory.forEach((h, i) => {
            const preview = h.content ? (h.content.length > 80 ? h.content.slice(0, 80) + '...' : h.content) : '';
            console.log(`  [${i + 1}] (${h.role}): ${preview}`);
        });
    }

    console.log('\n✉️ [EXACT MESSAGES SENT TO LLM]:');
    formattedMessages.forEach((m, idx) => {
        console.log(`\n--- Message ${idx + 1} [Role: ${m.role.toUpperCase()}] ---`);
        console.log(m.content);
    });
    console.log('\n' + '═'.repeat(85) + '\n');
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
 * @param {string} [params.userPlan] - User plan ('free'|'pro'|'premium')
 * @param {Function} params.onToken - Callback for streaming tokens (token: string) => void
 * @returns {Promise<Object>} Assembled result with reply, suggestedSnippet, resources, profile, intentData
 */
async function streamAssistantChat({ userId, reportId, message, selectedText, action, instruction, activeTab = '', currentRoute = '', userPlan = 'free', onToken }) {
    const { formattedMessages, promptText, foundResources, profile, intentData, isExplicitRewrite, dbCallsAvoided } = await buildAssistantPromptAndMessages({
        userId,
        reportId,
        message,
        selectedText,
        action,
        instruction,
        activeTab,
        currentRoute,
        userPlan
    });

    const fullReply = await streamLlmWithFallback({
        messages: formattedMessages,
        plan: userPlan,
        isAssistant: true,
        onToken
    });

    // Extract any suggested snippet and target text for in-place 1-click apply
    const { suggestedSnippet, targetText } = extractSnippetAndTargetFromReply(fullReply, isExplicitRewrite);

    // Save active turn in Redis memory buffer asynchronously
    processTurnInBackground(userId, promptText, fullReply);

    return {
        reply: fullReply,
        targetText: suggestedSnippet ? (targetText || selectedText || null) : null,
        suggestedSnippet,
        resources: foundResources,
        candidateProfile: profile,
        intentData,
        dbCallsAvoided
    };
}

/**
 * Non-streaming AI Assistant Orchestrator function (backward compatible)
 */
async function processAssistantChat({ userId, reportId, message, selectedText, action, instruction, activeTab = '', currentRoute = '', userPlan = 'free' }) {
    const { formattedMessages, promptText, foundResources, profile, intentData, isExplicitRewrite, dbCallsAvoided } = await buildAssistantPromptAndMessages({
        userId,
        reportId,
        message,
        selectedText,
        action,
        instruction,
        activeTab,
        currentRoute,
        userPlan
    });

    const llmResult = await callLlmWithFallback({
        messages: formattedMessages,
        plan: userPlan,
        isAssistant: true
    });

    const replyText = typeof llmResult === 'string' ? llmResult : (llmResult?.replyText || llmResult?.content || JSON.stringify(llmResult));
    const { suggestedSnippet, targetText } = extractSnippetAndTargetFromReply(replyText, isExplicitRewrite);

    processTurnInBackground(userId, promptText, replyText);

    return {
        reply: replyText,
        targetText: suggestedSnippet ? (targetText || selectedText || null) : null,
        suggestedSnippet,
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
    extractSnippetFromReply: (replyText, isExplicitRewrite) => extractSnippetAndTargetFromReply(replyText, isExplicitRewrite).suggestedSnippet,
    extractSnippetAndTargetFromReply
};
