const { classifyIntent } = require('./intentClassifier');
const { loadDynamicContext } = require('./dynamicContextLoader');
const { searchWeb, searchLearningResources } = require('./searchTool.service');
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
 * Extracts clean suggested snippet from assistant response ONLY if text improvement was explicitly requested
 */
function extractSnippetFromReply(replyText, isExplicitRewrite = false) {
    if (!replyText || typeof replyText !== 'string' || !isExplicitRewrite) return null;
    
    // 1. Explicit ```suggestion ... ``` code block
    const codeBlockMatch = replyText.match(/```(?:suggestion|snippet|resume)\s*\n?([\s\S]*?)```/i);
    if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].trim()) {
        return codeBlockMatch[1].trim();
    }

    // 2. Explicit "Suggested Rewrite:" or "Improved Version:" label
    const labeledMatch = replyText.match(/(?:Suggested Rewrite|Improved Version|Refined Bullet|Updated Text|Refined Text):\s*["“]?([^"”\n\r]+(?:[\n\r]+(?!\n|\r|#|\*)[^"”\n\r]+)*)["”]?/i);
    if (labeledMatch && labeledMatch[1] && labeledMatch[1].trim()) {
        return labeledMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    return null;
}

/**
 * Builds formatted prompt and context for KIVI AI Assistant using Smart Intent & Dynamic Context Loading
 */
async function buildAssistantPromptAndMessages({ userId, reportId = null, message = '', selectedText = '', action = '', instruction = '', userPlan = 'free' }) {
    const promptText = (message || instruction || '').trim();

    // 1. Step 1: Classify Query Intent (0ms Tier 1 with Tier 2 fallback)
    const intentData = await classifyIntent({
        message: promptText,
        selectedText,
        action,
        plan: userPlan
    });

    // 2. Step 2: Dynamically load ONLY the required pieces of context (0 DB calls for tech/help)
    const { candidateContextSnippet, recentHistory, profile, dbCallsAvoided } = await loadDynamicContext({
        userId,
        reportId,
        intentData
    });

    // 3. Step 3: Evaluate Tool Requirements (Search / Learning Resources)
    const toolFlags = detectToolRequirement(promptText);
    let toolContextSnippet = '';
    let foundResources = [];

    if (toolFlags.needsResources) {
        const topic = intentData.extracted_topic || promptText.replace(/give me|tutorials?|videos?|links?|resources?|how to learn|study material/gi, '').trim() || 'Software Engineering';
        foundResources = await searchLearningResources(topic, 3);
        
        if (foundResources.length > 0) {
            toolContextSnippet += `\n[Verified Learning Resources to Recommend]:\n` + 
                foundResources.map((r, i) => `${i + 1}. [${r.title}](${r.url}) - ${r.description || ''}`).join('\n') + '\n';
        }
    } else if (toolFlags.needsWebSearch) {
        const searchResults = await searchWeb(promptText, 3);
        if (searchResults.length > 0) {
            toolContextSnippet += `\n[Real-Time Live Web Information]:\n` + 
                searchResults.map((r, i) => `${i + 1}. ${r.title}: ${r.snippet} (Source: ${r.url})`).join('\n') + '\n';
        }
    }

    // 4. Step 4: Construct Strict Grounded System Prompt (Zero Hallucinations & Zero Fluff)
    let systemPrompt = `You are KIVI AI, a concise, highly factual AI Career Coach, Coding Mentor, and ATS Resume Copilot embedded in the KIVI-AI platform.

CRITICAL ANTI-HALLUCINATION & CONCISENESS RULES:
1. ANSWER ONLY WHAT IS ASKED: Do NOT provide unrequested sections, unsolicited document outlines, generic summaries, or conversational filler (e.g. "Sure!", "Certainly!", "Here is the information"). Jump straight into the direct answer.
2. ZERO HALLUCINATION: Do NOT invent fictional personas, artificial metrics (e.g. SUS scores), fake project details, or essay templates.
3. GROUNDED RETRIEVAL: When the user asks for their roadmap, interview score, or candidate data, use ONLY the exact data provided in the context below. If data is not provided, state that clearly in one brief sentence.
4. CLEAN MARKDOWN: Format with neat headings and bullet points. Never use raw HTML.`;

    const isExplicitResumeAction = ['enhance', 'shorten', 'fix_grammar', 'align_job', 'rephrase', 'make_ats'].includes(action);
    const isExplicitRewrite = (intentData.intent === 'RESUME' || intentData.intent === 'RESUME_EDIT') &&
        (Boolean(intentData.output_format === 'SUGGESTION_SNIPPET') || isExplicitResumeAction);

    // Intent-specific instructions for maximum token efficiency and clean formatting
    if (intentData.intent === 'ROADMAP' || intentData.intent === 'ROADMAP_RESOURCES') {
        systemPrompt += `\n\nTask: Present the Technical Preparation Roadmap.
Guidelines:
- If the user's Stored 14-Day Preparation Roadmap from their report is in the context below, present that EXACT day-by-day plan with its specific focus areas and tasks.
- Do NOT generate document-writing templates or essay outlines.
- If no stored plan exists in context, generate a crisp, realistic day-by-day technical study schedule for the target role.`;
    } else if (intentData.intent === 'RESUME' || intentData.intent === 'RESUME_EDIT') {
        if (isExplicitRewrite) {
            systemPrompt += `\n\nTask: Provide ATS-optimized text revisions.
Guidelines:
- Make bullet points punchy and results-oriented with strong action verbs and quantified impact metrics.
- Wrap ONLY the exact improved replacement text inside \`\`\`suggestion ... \`\`\` so the user can apply it directly in 1-click.`;
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
    } else if (intentData.intent === 'MULTI') {
        systemPrompt += `\n\nTask: Address each requested topic in distinct, clear sections.`;
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
async function streamAssistantChat({ userId, reportId, message, selectedText, action, instruction, userPlan = 'free', onToken }) {
    const { formattedMessages, promptText, foundResources, profile, intentData, isExplicitRewrite, dbCallsAvoided } = await buildAssistantPromptAndMessages({
        userId,
        reportId,
        message,
        selectedText,
        action,
        instruction,
        userPlan
    });

    const fullReply = await streamLlmWithFallback({
        messages: formattedMessages,
        plan: userPlan,
        isAssistant: true,
        onToken
    });

    // Extract any suggested snippet for 1-click apply button ONLY if explicit rewrite
    const suggestedSnippet = extractSnippetFromReply(fullReply, isExplicitRewrite);

    // Save active turn in Redis memory buffer asynchronously
    processTurnInBackground(userId, promptText, fullReply);

    return {
        reply: fullReply,
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
async function processAssistantChat({ userId, reportId, message, selectedText, action, instruction, userPlan = 'free' }) {
    const { formattedMessages, promptText, foundResources, profile, intentData, isExplicitRewrite, dbCallsAvoided } = await buildAssistantPromptAndMessages({
        userId,
        reportId,
        message,
        selectedText,
        action,
        instruction,
        userPlan
    });

    const llmResult = await callLlmWithFallback({
        messages: formattedMessages,
        plan: userPlan,
        isAssistant: true
    });

    const replyText = typeof llmResult === 'string' ? llmResult : (llmResult?.replyText || llmResult?.content || JSON.stringify(llmResult));
    const suggestedSnippet = extractSnippetFromReply(replyText, isExplicitRewrite);

    processTurnInBackground(userId, promptText, replyText);

    return {
        reply: replyText,
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
    extractSnippetFromReply
};
