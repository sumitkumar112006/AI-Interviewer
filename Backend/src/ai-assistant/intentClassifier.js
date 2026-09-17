const { callLlmWithFallback } = require('../services/ai.service');

/**
 * Standardized High-Precision Intent Taxonomy:
 * - RESUME: Resume/CV edits, section improvements, ATS optimization
 * - ROADMAP: Learning roadmaps, skill transitions, study plans, learning resources
 * - JOB_DESCRIPTION: JD analysis, job requirements, expected tech stack, qualifications
 * - RESUME_JD: Tailoring resume to JD, gap analysis, matching
 * - ROADMAP_JD: Aligning roadmap to job requirements, resource search for JD topics
 * - RESUME_ROADMAP: Assessing candidate experience against prep roadmap
 * - ALL_THREE: Holistic assessment across Resume, Job Description, and Roadmap
 * - DYNAMIC_SEARCH: Web, GitHub, LeetCode, Docs research
 * - GENERAL: General tech/programming concepts & trivia (0 DB query)
 * - PLATFORM_HELP: Kivi platform features, pricing, PDF download (0 DB query)
 * - SECURITY: Jailbreak, data exfiltration, system prompt extraction (safe rejection)
 * - UNKNOWN / AMBIGUOUS: Vague queries needing clarification
 */

/**
 * Fast Tier 1 Deterministic & Heuristic Intent Classifier (0ms latency, zero token cost)
 */
function classifyIntentTier1({ message = '', selectedText = '', action = '', activeTab = '', currentRoute = '' }) {
    const prompt = (message || '').trim();
    const lower = prompt.toLowerCase();
    const cleanAction = (action || '').toLowerCase().trim();
    const hasSelection = Boolean(selectedText && selectedText.trim());

    // ── 1. SECURITY & PROMPT INJECTION SHIELD ─────────────────────────────────
    const securityRegex = /(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?|system\s+prompt|give\s+me\s+all\s+(?:my\s+)?stored\s+data|dump\s+(?:the\s+)?database|show\s+(?:all\s+)?env|export\s+(?:all\s+)?users?|drop\s+table)/i;
    if (securityRegex.test(prompt)) {
        return {
            intent: 'SECURITY',
            action: 'REJECT',
            target: 'SECURITY',
            context: { resume: false, jd: false, roadmap: false },
            requires_context: false,
            context_keys: [],
            web_search: false,
            search_strategy: [],
            response_length: 'CONCISE',
            output_format: 'MARKDOWN_BULLETS',
            is_rewrite: false,
            history_turns_needed: 0,
            extracted_topic: null,
            confidence: 0.99
        };
    }

    // ── 2. EXPLICIT NEGATIVE & EXCLUSIVE CONSTRAINTS (Edge Cases) ─────────────
    const explicitNoJd = /(?:don'?t\s+use\s+jd|without\s+jd|jd\s+mat\s+use|no\s+jd\b|\bbina\s+jd\b(?!\s+ke\s+according))/i.test(prompt);
    const explicitNoRoadmap = /(?:don'?t\s+use\s+roadmap|without\s+roadmap|roadmap\s+mat\s+use|bina\s+roadmap\s+ke|no\s+roadmap)/i.test(prompt);
    const explicitNoResume = /(?:don'?t\s+use\s+resume|without\s+resume|resume\s+mat\s+use|bina\s+resume\s+ke|no\s+resume)/i.test(prompt);
    const explicitNoSearch = /(?:don'?t\s+search(?:\s+web)?|no\s+web\s+search|web\s+search\s+mat\s+karo|offline\s+only|no\s+search|bina\s+search\s+ke)/i.test(prompt);
    const explicitNoRewriteRoadmap = /(?:roadmap\s+ko\s+change\s+kiye\s+bina|roadmap\s+ko\s+rewrite\s+mat\s+karo|don'?t\s+rewrite\s+roadmap|without\s+modifying\s+roadmap|without\s+changing\s+roadmap|without\s+rewriting\s+roadmap)/i.test(prompt);

    // ── 3. SEARCH INTENT & DYNAMIC SOURCE STRATEGY ─────────────────────────────
    const searchKeywords = /(?:\bsearch\b|search\s+web|web\s+search|resources?|tutorials?|courses?|videos?|github|repo|repositories|open[\s-]source|leetcode|problems?|dsa|practice|docs|documentation|official\s+docs?|cheat\s+sheet|find\s+karo|search\s+karo|links?|projects?\s+with\s+source|examples?|learn|prepare|seekhna|research)/i;
    let wantsWebSearch = searchKeywords.test(prompt) && !explicitNoSearch;

    let searchStrategy = [];
    const onlyGithub = /(?:only\s+github|github\s+only|sirf\s+github|search\s+github\s+only|github\s+preference)/i.test(prompt);
    const onlyLeetCode = /(?:only\s+leetcode|leetcode\s+only|sirf\s+leetcode|search\s+leetcode\s+only|leetcode\s+preference)/i.test(prompt);
    const onlyDocs = /(?:only\s+official\s+docs?|official\s+docs?\s+only|sirf\s+official\s+docs?|official[\s-]source\s+preference|documentation\s+preference)/i.test(prompt);
    const onlyVideo = /(?:only\s+videos?|tutorials?\s+only|sirf\s+video|video\s+preference|tutorial\s+preference)/i.test(prompt);

    if (onlyGithub) {
        searchStrategy = ['github'];
    } else if (onlyLeetCode) {
        searchStrategy = ['leetcode'];
    } else if (onlyDocs) {
        searchStrategy = ['docs'];
    } else if (onlyVideo) {
        searchStrategy = ['video', 'tutorials'];
    } else {
        if (/(?:github|repo|repositories|open[\s-]source|source\s+code|real\s+project)/i.test(prompt)) {
            searchStrategy.push('github');
        }
        if (/(?:leetcode|\bdsa\b|coding\s+problems?|algorithms?|binary\s+search|\bgraphs?\b|\btrees?\b|\bdp\b|dynamic\s+programming|two\s+pointers?|(?<!full[\s-]|tech\s+|mern\s+|mean\s+)\bstack\b|\bqueue\b|\barrays?\b|linked\s+list)/i.test(prompt)) {
            searchStrategy.push('leetcode');
        }
        if (/(?:official\s+docs?|documentation|official\s+source|docs|guide|cheatsheet|cheat\s+sheet)/i.test(prompt)) {
            searchStrategy.push('docs');
        }
        if (/(?:video|youtube|watch|tutorial|courses?)/i.test(prompt)) {
            searchStrategy.push('video');
            searchStrategy.push('tutorials');
        }
    }

    // Handle negative search filters
    if (/(?:do\s+not\s+use\s+leetcode|no\s+leetcode|leetcode\s+mat\s+karo)/i.test(prompt)) {
        searchStrategy = searchStrategy.filter(s => s !== 'leetcode');
    }
    if (/(?:do\s+not\s+use\s+github|no\s+github|github\s+mat\s+karo)/i.test(prompt)) {
        searchStrategy = searchStrategy.filter(s => s !== 'github');
    }

    // ── 4. ENTITY DETECTION: RESUME, ROADMAP, JD ──────────────────────────────
    const allThreeRegex = /(?:teeno|all\s+three|all\s+available\s+context|har\s+ek\s+context|across\s+all\s+three|jd\s*,\s*resume\s+aur\s+roadmap|jd\s*\+\s*resume\s*\+\s*roadmap|resume\s*\+\s*roadmap\s*\+\s*jd|dono\s+me(?:\s+absent)?|sab\s+check|har\s+cheez|sabhi\s+context|complete\s+(?:assessment|analysis|overview|routing))/i;
    const isAllThreeExplicit = allThreeRegex.test(prompt);

    const hasResumeKeywords = /(?:resume|cv\b|rsum\b|biodata|bio\b|\bats\b|ats\s+friendly|ats\s+scan|ats\s+score|ats\s+optimize|ats\s+compatibility|bullet\s*points?|bullets?|summary\b|headline\b|project\s+titles?|project\s+description|projects?\s+section|experience\s+section|work\s+history|internship\s+section|hackathon\s+(?:section|experience)|skills\s+section|skills?\s+grouping|technical\s+skills|first\s+project|second\s+project|third\s+project|last\s+project|one[\s-]page|action\s+verbs?|quantify|formatting|grammar|proofreading|spelling\s+mistakes?|weak\s+bullets?|weak\s+wording|stronger\s+banao|measurable\s+impact|achievements?\s*section|achievements?|achievments?|achienvemt|missing\s+achievements?|education\s+section|portfolio\s+(?:link|section|project|gap)|linkedin\s+section|fresher[\s-]friendly|recruiter[\s-]friendly|profile\s+polish|mere\s+(?:projects?|skills?|experience|achievements?|bullets?)|meri\s+skills?|mera\s+(?:project|tech\s+stack|experience|portfolio|hackathon)|projects?\s+(?:reorder|optimize|evaluate|selection|impact|relevance)|engineering\s+impact|evidence\s+(?:mapping|remove|highlight)|unsupported\s+claims|existing\s+(?:experience|project)|skill\s+ordering|(?:strongest|weakest|irrelevant|duplicate)\s+(?:projects?|skills?|evidence|bullets?|information|technology)|(?<!roadmap\s+(?:me|ke\s+liye)\s+)missing\s+(?:projects?|skills?|evidence|bullets?)|(?:weak|strong|problem-solving)\s+evidence|supported\s+technology|(?:achievements?|certifications?|education)\s+(?:reorder|evaluate|section)|experience\s+highlight|portfolio\s+project|existing\s+project\s+(?:improve|extend|enhance)|(?:apply|add|put|insert|incorporate|include|integrate)\s+(?:these|this|some|more|the|my|soft)?\s*(?:skills?|bullet|change|feedback|experience|projects?|technology|tech)?)/i.test(prompt);
    const hasJdKeywords = /(?:jd\b|job\s+description|job\s+requirements?|this\s+job|target\s+job|target\s+role|is\s+job\s+ke|job\s+spec|must[\s-]have|nice[\s-]to[\s-]have|qualifications?|responsibilities|recruiter\s+perspective|expected\s+tech\s+stack|candidate\s+expectations|minimum\s+qualifications|interview\s+prep\s+for\s+this\s+job|apply\s+karna\s+hai)/i.test(prompt);
    const hasRoadmapKeywords = /(?:roadmap|14[\s-]day|day\s+\d+|milestone|study\s+plan|learning\s+path|prep\s+plan|preparation\s+plan|next\s+kya\s+seekhna|seekhne\s+ke\s+resources|current\s+topic|next\s+topic|previous\s+topic|completed\s+topics?|upcoming\s+topics?|roadmap\s+stage|current\s+skill|next\s+skill|(?:coding|system\s+design|debugging|hands-on)\s+exercises?|(?:skill|learning)\s+gap)/i.test(prompt);
    // NOTE: `learning resources` and `practice resources` removed from hasRoadmapKeywords — they triggered false Roadmap
    // for standalone search queries like "Practice resources for Docker find karo". These phrases only mean Roadmap
    // when the word 'roadmap' is explicitly present (which is already caught by the main 'roadmap' keyword above).

    let needsResume = (hasResumeKeywords || isAllThreeExplicit) && !explicitNoResume;
    let needsJd = (hasJdKeywords || isAllThreeExplicit) && !explicitNoJd;
    let needsRoadmap = (hasRoadmapKeywords || isAllThreeExplicit) && !explicitNoRoadmap;

    // ── 4b. IMPLICIT TRI-CONTEXT ESCALATION ───────────────────────────────────
    // If a query mentions exactly 2 entities AND uses comparison/mapping language, escalate to ALL_THREE
    const implicitTriCompare = /(?:compare|map|match|align|check|identify|analysis|analyze|assess|evaluate|gap|preparation|dono)/i.test(prompt);
    if (implicitTriCompare) {
        // If query mentions JD + Resume but also implies roadmap comparison ("gaps", "preparation", "learning")
        if (needsJd && needsResume && !needsRoadmap && !explicitNoRoadmap) {
            if (/(?:gap|preparation|learning|skills?\s+me\s+se|roadmap)/i.test(prompt)) {
                needsRoadmap = true;
            }
        }
        // If query mentions JD + Roadmap but also implies resume context ("available", "evidence", "existing")
        if (needsJd && needsRoadmap && !needsResume && !explicitNoResume) {
            if (/(?:available|evidence|existing|resume|experience|portfolio)/i.test(prompt)) {
                needsResume = true;
            }
        }
    }

    // Active Screen Context Fallback (when query is short / ambiguous)
    if (!needsResume && !needsJd && !needsRoadmap) {
        if (hasSelection || activeTab === 'resume' || currentRoute.includes('/resume/')) {
            needsResume = true;
        } else if (activeTab === 'roadmap' || currentRoute.includes('tab=roadmap')) {
            needsRoadmap = true;
        } else if (activeTab === 'jd' || lower.includes('job')) {
            needsJd = true;
        }
    }

    // ── 5. COMBINATIONS RESOLUTION ────────────────────────────────────────────

    // Group G: ALL THREE (Resume + JD + Roadmap)
    if (needsResume && needsJd && needsRoadmap) {
        return {
            intent: 'ALL_THREE',
            action: 'ASSESS_AND_PLAN',
            target: 'COMPREHENSIVE',
            context: { resume: true, jd: true, roadmap: true },
            requires_context: true,
            context_keys: ['resume', 'job', 'roadmap', 'skills'],
            web_search: wantsWebSearch,
            search_strategy: searchStrategy.length > 0 ? searchStrategy : ['docs', 'github'],
            response_length: 'COMPREHENSIVE',
            output_format: 'MARKDOWN_BULLETS',
            is_rewrite: false,
            history_turns_needed: 0,
            extracted_topic: extractTopicFromPrompt(prompt),
            confidence: 0.98
        };
    }

    // Group D: RESUME + JD
    if (needsResume && needsJd && !needsRoadmap) {
        const isRewrite = /(?:optimize|rewrite|tailor|align|improve|integrate|reorder|shorten|expand|apply|add|put|insert|incorporate|include)/i.test(prompt) || hasSelection;
        return {
            intent: 'RESUME_JD',
            action: isRewrite ? 'TAILOR_RESUME' : 'COMPARE_MATCH',
            target: 'RESUME_ATS',
            context: { resume: true, jd: true, roadmap: false },
            requires_context: true,
            context_keys: ['resume', 'job'],
            web_search: wantsWebSearch,
            search_strategy: searchStrategy,
            response_length: 'BALANCED',
            output_format: isRewrite ? 'SUGGESTION_SNIPPET' : 'MARKDOWN_BULLETS',
            is_rewrite: isRewrite,
            history_turns_needed: 0,
            extracted_topic: extractTopicFromPrompt(prompt),
            confidence: 0.98
        };
    }

    // Group E: JD + ROADMAP
    if (!needsResume && needsJd && needsRoadmap) {
        return {
            intent: 'ROADMAP_JD',
            action: 'ALIGN_LEARNING',
            target: 'ROADMAP_RESOURCES',
            context: { resume: false, jd: true, roadmap: true },
            requires_context: true,
            context_keys: ['job', 'roadmap'],
            web_search: true, // Always search resources for JD learning gap
            search_strategy: searchStrategy.length > 0 ? searchStrategy : ['github', 'docs', 'tutorials'],
            response_length: 'COMPREHENSIVE',
            output_format: 'STEP_BY_STEP',
            is_rewrite: false, // Never rewrite roadmap
            history_turns_needed: 0,
            extracted_topic: extractTopicFromPrompt(prompt),
            confidence: 0.98
        };
    }

    // Group F: RESUME + ROADMAP
    if (needsResume && !needsJd && needsRoadmap) {
        const isRewrite = /(?:apply|add|put|insert|incorporate|include|integrate|update|change|modify|fix|replace|\buse\b|rewrite|optimize|tailor|align|improve)/i.test(prompt) || hasSelection;
        return {
            intent: 'RESUME_ROADMAP',
            action: isRewrite ? 'APPLY_ROADMAP_TO_RESUME' : 'RECOMMEND_LEARNING',
            target: 'SKILL_GAP',
            context: { resume: true, jd: false, roadmap: true },
            requires_context: true,
            context_keys: ['resume', 'roadmap', 'skills'],
            web_search: wantsWebSearch,
            search_strategy: searchStrategy.length > 0 ? searchStrategy : ['docs', 'github'],
            response_length: 'BALANCED',
            output_format: isRewrite ? 'SUGGESTION_SNIPPET' : 'MARKDOWN_BULLETS',
            is_rewrite: isRewrite,
            history_turns_needed: 0,
            extracted_topic: extractTopicFromPrompt(prompt),
            confidence: 0.97
        };
    }

    // Group A: ROADMAP ONLY (Learning & Practice Resources)
    if (needsRoadmap && !needsResume && !needsJd) {
        return {
            intent: 'ROADMAP',
            action: 'PROVIDE_RESOURCES',
            target: 'LEARNING_RESOURCES',
            context: { resume: false, jd: false, roadmap: true },
            requires_context: true,
            context_keys: ['roadmap', 'skills'],
            web_search: true, // Learning roadmap queries always search verified resources
            search_strategy: searchStrategy.length > 0 ? searchStrategy : ['docs', 'github', 'tutorials'],
            response_length: 'COMPREHENSIVE',
            output_format: 'STEP_BY_STEP',
            is_rewrite: false, // User requested: do NOT rewrite roadmap
            history_turns_needed: 0,
            extracted_topic: extractTopicFromPrompt(prompt),
            confidence: 0.98
        };
    }

    // Group B: RESUME ONLY
    if (needsResume && !needsRoadmap && !needsJd) {
        const isExplicitAction = ['enhance', 'shorten', 'fix_grammar', 'rephrase', 'make_ats', 'bullet', 'apply', 'add', 'insert', 'replace', 'use'].includes(cleanAction);
        const hasApplyVerb = /(?:apply|add|put|insert|incorporate|include|integrate|update|change|modify|fix|replace|\buse\b|make\s+that\s+change|do\s+(?:it|the\s+change)|go\s+ahead|okay|keep|preserve|don'?t\s+rewrite|don'?t\s+regenerate|don'?t\s+touch|only\s+update|only\s+replace|only\s+make|laga\s+do|laga\s+de|dal\s+do|daal\s+do|daal\s+de|badal\s+do|change\s+kar|replace\s+kar|apply\s+karo|apply\s+kar|wapas\s+kar|wapas\s+lao|second\s+wala|first\s+wala|ye\s+wala|green\s+wala)/i.test(prompt);
        
        const isAdviceOrBroadResponse = /(?:advice|recommendations?|analysis|answer|entire\s+response|everything\s+you\s+wrote|all\s+of\s+that|complete\s+thing|everywhere|everything\b)/i.test(prompt) && !/(?:bullet|line|sentence|summary|skills|project|section|snippet|wording|text|title)/i.test(prompt);

        const isExplicitRewrite = (isExplicitAction || hasApplyVerb || /(?:improve|rewrite|refine|rephrase|format|make\s+ats|ats\s+friendly|stronger|banao|polish|shorten|expand|remove)/i.test(prompt) || hasSelection) && !isAdviceOrBroadResponse;
        const isInfoOnly = (/(?:what\s+is|review|feedback|critique|check|score|analyze|rate|tips)/i.test(prompt) && !hasSelection && !hasApplyVerb) || isAdviceOrBroadResponse;

        const isSnippet = !isInfoOnly && isExplicitRewrite;

        return {
            intent: 'RESUME',
            action: isSnippet ? 'REFINE' : 'REVIEW',
            target: 'RESUME_CONTENT',
            context: { resume: true, jd: false, roadmap: false },
            requires_context: true,
            context_keys: ['resume'],
            web_search: false,
            search_strategy: [],
            response_length: cleanAction === 'shorten' ? 'CONCISE' : 'BALANCED',
            output_format: isSnippet ? 'SUGGESTION_SNIPPET' : 'MARKDOWN_BULLETS',
            is_rewrite: isSnippet,
            history_turns_needed: 0,
            extracted_topic: null,
            confidence: 0.98
        };
    }

    // Group C: JD ONLY
    if (needsJd && !needsResume && !needsRoadmap) {
        return {
            intent: 'JOB_DESCRIPTION',
            action: 'ANALYZE_REQUIREMENTS',
            target: 'JOB_SPEC',
            context: { resume: false, jd: true, roadmap: false },
            requires_context: true,
            context_keys: ['job'],
            web_search: wantsWebSearch,
            search_strategy: searchStrategy,
            response_length: 'BALANCED',
            output_format: 'MARKDOWN_BULLETS',
            is_rewrite: false,
            history_turns_needed: 0,
            extracted_topic: extractTopicFromPrompt(prompt),
            confidence: 0.98
        };
    }

    // Group H: DYNAMIC SEARCH / TECHNICAL RESOURCE LOOKUP (0 DB Context, Web Search Active)
    if (wantsWebSearch) {
        return {
            intent: 'DYNAMIC_SEARCH',
            action: 'SEARCH',
            target: 'EXTERNAL_WEB',
            context: { resume: false, jd: false, roadmap: false },
            requires_context: false,
            context_keys: [],
            web_search: true,
            search_strategy: searchStrategy.length > 0 ? searchStrategy : ['web', 'docs'],
            response_length: 'BALANCED',
            output_format: 'MARKDOWN_BULLETS',
            is_rewrite: false,
            history_turns_needed: 0,
            extracted_topic: extractTopicFromPrompt(prompt),
            confidence: 0.95
        };
    }

    // Group 8: GENERAL TECH CONCEPTS / PLATFORM HELP (0 DB Context, 0 Web Search)
    const techRegex = /(?:leetcode|two\s+sum|binary\s+tree|closure|promise|async\/await|event\s+loop|docker|kubernetes|sql|mongo|redis|debug|algorithm|time\s+complexity|space\s+complexity|explain|what\s+is|how\s+does|react|node|javascript|python|concept|samjhao|tutorial|offline)/i;
    if (techRegex.test(prompt)) {
        return {
            intent: 'GENERAL',
            action: 'ANSWER',
            target: 'GENERAL',
            context: { resume: false, jd: false, roadmap: false },
            requires_context: false,
            context_keys: [],
            web_search: false,
            search_strategy: [],
            response_length: 'BALANCED',
            output_format: 'MARKDOWN_BULLETS',
            is_rewrite: false,
            history_turns_needed: 0,
            extracted_topic: prompt.slice(0, 50),
            confidence: 0.95
        };
    }

    // Fallback: Check platform help
    const platformRegex = /(?:about\s+(?:project|app|application|kivi)|what\s+is\s+kivi|how\s+to\s+use|pricing|pro\s+plan|free\s+plan|download\s+pdf|export\s+pdf)/i;
    if (platformRegex.test(prompt)) {
        return {
            intent: 'PLATFORM_HELP',
            action: 'EXPLAIN',
            target: 'GENERAL',
            context: { resume: false, jd: false, roadmap: false },
            requires_context: false,
            context_keys: [],
            web_search: false,
            search_strategy: [],
            response_length: 'CONCISE',
            output_format: 'MARKDOWN_BULLETS',
            is_rewrite: false,
            history_turns_needed: 0,
            extracted_topic: null,
            confidence: 0.95
        };
    }

    // ── FINAL SAFETY NET — NEVER return null ──────────────────────────────────
    // Vague/short queries like "Isko improve karo", "Ab kya karu?" land here.
    // These need conversational context (history) to resolve, so we route to GENERAL
    // with low confidence and let the orchestrator handle them via Tier 2 or conversation history.
    return {
        intent: 'GENERAL',
        action: 'ANSWER',
        target: 'GENERAL',
        context: { resume: false, jd: false, roadmap: false },
        requires_context: false,
        context_keys: [],
        web_search: false,
        search_strategy: [],
        response_length: 'BALANCED',
        output_format: 'MARKDOWN_BULLETS',
        is_rewrite: false,
        history_turns_needed: 3,  // Needs conversation history to resolve ambiguity
        extracted_topic: prompt.slice(0, 50),
        confidence: 0.3  // Low confidence = signal to orchestrator to use Tier 2 LLM fallback
    };
}

/**
 * Extracts the primary technology/topic from a natural-language query
 */
function extractTopicFromPrompt(prompt = '') {
    if (!prompt) return null;
    const clean = prompt
        .replace(/(?:roadmap|according|ke|ki|ka|ko|me|se|par|liye|mujhe|resources?|do|find|karo|batao|give|me|best|learning|practice|seekhna|hai|is|jd|requirements?|mera|meri|mere|resume|improve|search|tutorials?|official|docs?|github|leetcode|problems?|examples?|projects?|open[\s-]source|repo|repositories|videos?|courses?|notes|cheatsheet|cheat\s+sheet|next|previous|current|topic|listed|technology|technologies|section|questions?|exercises?|assignments?|please|want|how|to)/gi, ' ')
        .replace(/[^\w\s\+#\.\-]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return clean.length >= 2 ? clean : null;
}

/**
 * Tier 2: Micro-LLM Semantic Classifier Fallback for edge cases
 */
async function classifyIntentTier2(message, plan = 'free') {
    const systemPrompt = `You are a career AI Assistant context and search router.
Classify the user query and return JSON matching this exact structure:
{
  "intent": "RESUME" | "ROADMAP" | "JOB_DESCRIPTION" | "RESUME_JD" | "ROADMAP_JD" | "RESUME_ROADMAP" | "ALL_THREE" | "DYNAMIC_SEARCH" | "GENERAL" | "PLATFORM_HELP" | "SECURITY" | "UNKNOWN",
  "action": "PROVIDE_RESOURCES" | "TAILOR_RESUME" | "REFINE" | "REVIEW" | "ANALYZE_REQUIREMENTS" | "ALIGN_LEARNING" | "ANSWER" | "SEARCH",
  "target": "RESUME_CONTENT" | "LEARNING_RESOURCES" | "JOB_SPEC" | "RESUME_ATS" | "GENERAL",
  "context": {
    "resume": boolean,
    "jd": boolean,
    "roadmap": boolean
  },
  "requires_context": boolean,
  "context_keys": string[],
  "web_search": boolean,
  "search_strategy": string[],
  "response_length": "CONCISE" | "BALANCED" | "COMPREHENSIVE",
  "output_format": "SUGGESTION_SNIPPET" | "MARKDOWN_BULLETS" | "STEP_BY_STEP",
  "is_rewrite": boolean,
  "confidence": number
}

Rules:
- If user asks for roadmap resources or tutorials, set context.roadmap: true, web_search: true. Do NOT rewrite roadmap.
- If query compares resume to JD, set context.resume: true, context.jd: true.
- If query compares roadmap to JD, set context.roadmap: true, context.jd: true, web_search: true.
- If query asks general tech concept, set context.resume: false, context.jd: false, context.roadmap: false, web_search: false.
- Return ONLY valid raw JSON without markdown or backticks.`;

    try {
        const rawJson = await callLlmWithFallback({
            systemPrompt,
            userPrompt: message,
            plan,
            isAssistant: true
        });

        const cleaned = (rawJson || '').replace(/^```json\s*|\s*```$/gi, '').trim();
        const parsed = JSON.parse(cleaned);

        const ctx = parsed.context || {};
        const hasAnyContext = Boolean(ctx.resume || ctx.jd || ctx.roadmap);

        return {
            intent: parsed.intent || 'GENERAL',
            action: parsed.action || 'ANSWER',
            target: parsed.target || 'GENERAL',
            context: {
                resume: Boolean(ctx.resume),
                jd: Boolean(ctx.jd),
                roadmap: Boolean(ctx.roadmap)
            },
            requires_context: hasAnyContext,
            context_keys: Array.isArray(parsed.context_keys) ? parsed.context_keys : [],
            web_search: Boolean(parsed.web_search),
            search_strategy: Array.isArray(parsed.search_strategy) ? parsed.search_strategy : [],
            response_length: parsed.response_length || 'BALANCED',
            output_format: parsed.output_format || 'MARKDOWN_BULLETS',
            is_rewrite: Boolean(parsed.is_rewrite),
            history_turns_needed: 0,
            extracted_topic: extractTopicFromPrompt(message),
            confidence: parsed.confidence || 0.85
        };
    } catch (err) {
        console.warn('[IntentClassifier] Tier 2 fallback error:', err.message);
        return {
            intent: 'GENERAL',
            action: 'ANSWER',
            target: 'GENERAL',
            context: { resume: false, jd: false, roadmap: false },
            requires_context: false,
            context_keys: [],
            web_search: false,
            search_strategy: [],
            response_length: 'BALANCED',
            output_format: 'MARKDOWN_BULLETS',
            is_rewrite: false,
            history_turns_needed: 0,
            extracted_topic: null,
            confidence: 0.70
        };
    }
}

/**
 * Main Intent Classifier Entry Point
 */
async function classifyIntent({ message = '', selectedText = '', action = '', activeTab = '', currentRoute = '', plan = 'free' }) {
    const tier1Result = classifyIntentTier1({ message, selectedText, action, activeTab, currentRoute });
    if (tier1Result && tier1Result.confidence >= 0.85) {
        return tier1Result;
    }

    return await classifyIntentTier2(message, plan);
}

module.exports = {
    classifyIntent,
    classifyIntentTier1,
    classifyIntentTier2,
    extractTopicFromPrompt
}
