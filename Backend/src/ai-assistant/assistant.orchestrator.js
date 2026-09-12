const { assembleContext } = require('./contextAssembler');
const { searchWeb, searchLearningResources } = require('./searchTool.service');
const { processTurnInBackground } = require('./memoryExtractor');
const { callLlmWithFallback, streamLlmWithFallback } = require('../services/ai.service');

/**
 * Heuristic to detect if query explicitly asks for tutorials, video links, or live web info
 */
function detectToolRequirement(message) {
    const text = (message || '').toLowerCase();
    
    const isResourceQuery = text.includes('tutorial') || 
                           text.includes('youtube') || 
                           text.includes('video') || 
                           text.includes('roadmap') || 
                           text.includes('learn') || 
                           text.includes('course') ||
                           text.includes('resource') ||
                           text.includes('where to study') ||
                           text.includes('documentation') ||
                           text.includes('study material');

    const isLiveSearchQuery = text.includes('latest') || 
                             text.includes('current') || 
                             text.includes('new in') || 
                             text.includes('release') || 
                             text.includes('market trend') || 
                             text.includes('2025') || 
                             text.includes('2026') ||
                             text.includes('salary');

    return {
        needsResources: isResourceQuery,
        needsWebSearch: isLiveSearchQuery
    };
}

/**
 * Extracts clean suggested snippet from assistant response if text improvement was requested
 */
function extractSnippetFromReply(replyText, selectedText) {
    if (!replyText || typeof replyText !== 'string') return null;
    
    // Check for ```suggestion ... ``` or ```snippet ... ``` or ```resume ... ```
    const codeBlockMatch = replyText.match(/```(?:suggestion|snippet|resume|diff)?\s*\n([\s\S]*?)\n```/i);
    if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].trim()) {
        return codeBlockMatch[1].trim();
    }

    // Check for "Suggested Rewrite:" or "Improved Version:" or "Refined Bullet:"
    const labeledMatch = replyText.match(/(?:Suggested Rewrite|Improved Version|Refined Bullet|Updated Text|Refined Text):\s*["“]?([^"”\n\r]+(?:[\n\r]+(?!\n|\r|#|\*)[^"”\n\r]+)*)["”]?/i);
    if (labeledMatch && labeledMatch[1] && labeledMatch[1].trim()) {
        return labeledMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    // If selectedText was provided, and the reply contains a quoted block
    const quoteMatch = replyText.match(/["“]([^"”]{10,})["”]/);
    if (quoteMatch && quoteMatch[1] && quoteMatch[1].trim() && quoteMatch[1].trim() !== selectedText.trim()) {
        return quoteMatch[1].trim();
    }

    return null;
}

/**
 * Builds formatted prompt and context for KIVI AI Assistant
 */
async function buildAssistantPromptAndMessages({ userId, reportId = null, message = '', selectedText = '', action = 'enhance', instruction = '' }) {
    const promptText = (message || instruction || '').trim();
    const lowerPrompt = promptText.toLowerCase();

    // 1. Assemble Candidate & Current Report Job Context (Single report JD, no multi-report bloat)
    const { candidateContextSnippet, recentHistory, profile } = await assembleContext(userId, reportId);

    // 2. Evaluate Tool Requirements (Search / Resources)
    const toolFlags = detectToolRequirement(promptText);
    let toolContextSnippet = '';
    let foundResources = [];

    if (toolFlags.needsResources) {
        const topic = promptText.replace(/give me|tutorials|videos|links|resources|how to learn|study material/gi, '').trim() || 'Software Engineering';
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

    // 3. Detect Platform / Project queries
    const isAskingAboutProject = (
        lowerPrompt.includes("about project") ||
        lowerPrompt.includes("about app") ||
        lowerPrompt.includes("about application") ||
        lowerPrompt.includes("what is this") ||
        lowerPrompt.includes("how this project works") ||
        lowerPrompt.includes("how to use") ||
        lowerPrompt.includes("what can you do") ||
        lowerPrompt.includes("features of this app") ||
        lowerPrompt.includes("kivi-ai") ||
        lowerPrompt.includes("who created") ||
        lowerPrompt.includes("what is kivi") ||
        lowerPrompt.includes("tell me about") ||
        lowerPrompt.includes("how does this work")
    );

    let systemPrompt = `You are KIVI AI, a senior AI Interview Coach, Career Mentor, and ATS Resume Copilot embedded in the KIVI-AI platform.
Your mission is to provide concise, practical, high-impact career advice, interview preparation answers, and ATS resume improvements.

Formatting & Style Guidelines:
1. Format your response cleanly using standard markdown: clear section headings (###), bold key terms, and neat bullet points (- or 1.).
2. Do NOT use raw HTML tags like <br> or wide congested markdown tables. Use clean bulleted lists or subheadings instead for maximum readability on chat/mobile screens.
3. Be direct, structured, and actionable. Avoid unnecessary fluff or repetitive intros.
4. If current target job description / requirements are provided below, tailor your advice specifically to that role and company.
5. If verified learning resources or web results are provided, seamlessly reference them with clean markdown links.`;

    if (isAskingAboutProject) {
        systemPrompt += `

About KIVI-AI Platform:
- Purpose: End-to-end AI career platform helping software engineers practice mock interviews, identify skill gaps, and build ATS-friendly resumes.
- Key Capabilities:
  1. AI Technical Mock Interviews: Real-time interactive technical & behavioral assessments.
  2. Granular Skill Analytics: Performance benchmarks and targeted 14-day roadmaps.
  3. ATS Resume & Cover Letter Studio: Automatically generates professional, tailored A4 resumes with live in-browser sheet editing & 1:1 PDF exports.
  4. KIVI AI Assistant: Floating AI copilot for live text rewriting, bullet point enhancement, and career mentoring.`;
    }

    let userContent = promptText;
    if (selectedText && selectedText.trim()) {
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
    }

    const fullSystemPrompt = `${systemPrompt}
${candidateContextSnippet}
${toolContextSnippet}`;

    const formattedMessages = [
        { role: 'system', content: fullSystemPrompt },
        ...recentHistory,
        { role: 'user', content: userContent }
    ];

    return {
        formattedMessages,
        promptText: promptText || (selectedText ? `Refine: ${selectedText.slice(0, 30)}...` : 'Assistant Query'),
        foundResources,
        profile
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
 * @returns {Promise<Object>} Assembled result with reply, suggestedSnippet, resources, and profile
 */
async function streamAssistantChat({ userId, reportId, message, selectedText, action, instruction, userPlan = 'free', onToken }) {
    const { formattedMessages, promptText, foundResources, profile } = await buildAssistantPromptAndMessages({
        userId,
        reportId,
        message,
        selectedText,
        action,
        instruction
    });

    const fullReply = await streamLlmWithFallback({
        messages: formattedMessages,
        plan: userPlan,
        isAssistant: true,
        onToken
    });

    // Extract any suggested snippet for 1-click apply button
    const suggestedSnippet = extractSnippetFromReply(fullReply, selectedText);

    // Save active turn in Redis memory buffer asynchronously
    processTurnInBackground(userId, promptText, fullReply);

    return {
        reply: fullReply,
        suggestedSnippet,
        resources: foundResources,
        candidateProfile: profile
    };
}

/**
 * Non-streaming AI Assistant Orchestrator function (backward compatible)
 */
async function processAssistantChat({ userId, reportId, message, selectedText, action, instruction, userPlan = 'free' }) {
    const { formattedMessages, promptText, foundResources, profile } = await buildAssistantPromptAndMessages({
        userId,
        reportId,
        message,
        selectedText,
        action,
        instruction
    });

    const llmResult = await callLlmWithFallback({
        messages: formattedMessages,
        plan: userPlan,
        isAssistant: true
    });

    const replyText = typeof llmResult === 'string' ? llmResult : (llmResult?.replyText || llmResult?.content || JSON.stringify(llmResult));
    const suggestedSnippet = extractSnippetFromReply(replyText, selectedText);

    processTurnInBackground(userId, promptText, replyText);

    return {
        reply: replyText,
        suggestedSnippet,
        resources: foundResources,
        candidateProfile: profile
    };
}

module.exports = {
    streamAssistantChat,
    processAssistantChat,
    detectToolRequirement,
    extractSnippetFromReply
};
