/**
 * ==============================================================================
 * 🤖 AI Model Configuration — Tier-Based Model Selection & Priority Waterfall
 * ==============================================================================
 * 
 * 🌊 PRIORITY WATERFALL CASCADE ARCHITECTURE:
 * 
 * 1. Groq Keys Priority Order (Key 1 → Key 2 → Key 3):
 *    - Every incoming AI request always starts with Key 1 (as long as it is healthy).
 *    - If Key 1 hits a rate limit (HTTP 429), it sets Key 1 on cooldown and instantly
 *      fails over to Key 2 in the exact same request.
 *    - If Key 2 also hits a rate limit, it sets Key 2 on cooldown and instantly
 *      fails over to Key 3 in the exact same request.
 * 
 * 2. Secondary Provider Fallbacks (Gemini → OpenRouter):
 *    - If all Groq keys fail or are cooling down, the request falls back to Gemini.
 *    - If Gemini fails (or is unauthenticated), the request falls back to OpenRouter (Nemotron 120B).
 * 
 * 3. Automatic Recovery & Re-prioritization:
 *    - On server boot/restart, requests always start from Key 1.
 *    - The moment any key's cooldown window ends (e.g. 60s), subsequent requests
 *      automatically jump straight back to Key 1 (Primary Priority).
 * 
 * ==============================================================================
 * 📊 MODEL TIERS MAPPING PER SUBSCRIPTION PLAN:
 * ==============================================================================
 * ┌──────────┬──────────────────────────────┬───────────────────────┬──────────────────────────────────────────┐
 * │ Plan     │ Groq                         │ Gemini                │ OpenRouter                               │
 * ├──────────┼──────────────────────────────┼───────────────────────┼──────────────────────────────────────────┤
 * │ Free     │ openai/gpt-oss-120b          │ gemini-2.5-flash      │ nvidia/nemotron-3-super-120b-a12b:free   │
 * │ Pro      │ openai/gpt-oss-120b          │ gemini-2.5-flash      │ nvidia/nemotron-3-super-120b-a12b:free   │
 * │ Premium  │ openai/gpt-oss-120b          │ gemini-2.5-flash      │ nvidia/nemotron-3-super-120b-a12b:free   │
 * └──────────┴──────────────────────────────┴───────────────────────┴──────────────────────────────────────────┘
 */

const AI_MODEL_TIERS = {
    free: {
        groq: "openai/gpt-oss-120b",                         // 120B — highest quality on Groq, strong structured output
        gemini: "gemini-3.5-flash",                         // Cheapest Gemini Flash
        openrouter: "nvidia/nemotron-3-super-120b-a12b:free", // Free 120B — zero cost fallback
        maxTokens: {
            groq: 4096,
            gemini: 4096,
            openrouter: 4096,
        },
        temperature: 0.7,
    },
    pro: {
        groq: "openai/gpt-oss-120b",                       // 120B — highest quality on Groq, strong structured output
        gemini: "gemini-3.5-flash",                         // Flash — fast, cost-effective, great for JSON
        openrouter: "nvidia/nemotron-3-super-120b-a12b:free", // Valid Free 120B model
        maxTokens: {
            groq: 4096,
            gemini: 8192,
            openrouter: 8192,
        },
        temperature: 0.7,
    },
    premium: {
        groq: "openai/gpt-oss-120b",                       // 120B — same Groq model
        gemini: "gemini-3.5-flash",                         // Flash — fast, cost-effective
        openrouter: "nvidia/nemotron-3-super-120b-a12b:free", // Valid Free 120B model
        maxTokens: {
            groq: 8192, 
            gemini: 8192,
            openrouter: 8192,
        },
        temperature: 0.65,                                  // Slightly lower temp for more precise premium output
    },
};

/**
 * Resolve the correct model set for a given subscription plan.
 * Falls back to free tier if plan is unknown.
 * 
 * @param {string} plan - User's subscription plan ('free' | 'pro' | 'premium')
 * @returns {Object} Model configuration for the plan
 */
function resolveModelsForPlan(plan = "free") {
    const normalizedPlan = (plan || "free").toLowerCase();
    return AI_MODEL_TIERS[normalizedPlan] || AI_MODEL_TIERS.free;
}

/**
 * AI Assistant Configuration
 * Chat-based assistant tasks require lower token output limits and 
 * slightly different temperatures to maintain conversational context without hallucinating.
 */
const ASSISTANT_MODEL_TIERS = {
    free: {
        groq: "openai/gpt-oss-120b",
        gemini: "gemini-3.5-flash",
        openrouter: "nvidia/nemotron-3-super-120b-a12b:free",
        maxTokens: {
            groq: 1024,
            gemini: 1024,
            openrouter: 1024,
        },
        temperature: 0.5,
    },
    pro: {
        groq: "openai/gpt-oss-120b",
        gemini: "gemini-3.5-flash",
        openrouter: "nvidia/nemotron-3-super-120b-a12b:free",
        maxTokens: {
            groq: 2048,
            gemini: 2048,
            openrouter: 2048,
        },
        temperature: 0.6,
    },
    premium: {
        groq: "openai/gpt-oss-120b",
        gemini: "gemini-3.5-flash",
        openrouter: "nvidia/nemotron-3-super-120b-a12b:free",
        maxTokens: {
            groq: 4096,
            gemini: 4096,
            openrouter: 4096,
        },
        temperature: 0.6,
    },
};

/**
 * Resolve the correct assistant model set for a given subscription plan.
 */
function resolveAssistantModelsForPlan(plan = "free") {
    const normalizedPlan = (plan || "free").toLowerCase();
    return ASSISTANT_MODEL_TIERS[normalizedPlan] || ASSISTANT_MODEL_TIERS.free;
}

/**
 * Get just the model ID for a specific provider and plan.
 * 
 * @param {string} plan - User's subscription plan
 * @param {string} provider - 'groq' | 'gemini' | 'openrouter'
 * @param {boolean} isAssistant - If true, uses the assistant config
 * @returns {string} Model ID string
 */
function getModelForProvider(plan = "free", provider = "groq", isAssistant = false) {
    const models = isAssistant ? resolveAssistantModelsForPlan(plan) : resolveModelsForPlan(plan);
    return models[provider] || (isAssistant ? ASSISTANT_MODEL_TIERS.free[provider] : AI_MODEL_TIERS.free[provider]);
}

/**
 * Get max tokens for a specific provider and plan.
 * 
 * @param {string} plan - User's subscription plan
 * @param {string} provider - 'groq' | 'gemini' | 'openrouter'
 * @param {boolean} isAssistant - If true, uses the assistant config
 * @returns {number} Max tokens
 */
function getMaxTokensForProvider(plan = "free", provider = "groq", isAssistant = false) {
    const models = isAssistant ? resolveAssistantModelsForPlan(plan) : resolveModelsForPlan(plan);
    return models.maxTokens?.[provider] || 4096;
}

/**
 * Get temperature for a specific plan.
 * 
 * @param {string} plan - User's subscription plan
 * @param {boolean} isAssistant - If true, uses the assistant config
 * @returns {number} Temperature
 */
function getTemperatureForPlan(plan = "free", isAssistant = false) {
    const models = isAssistant ? resolveAssistantModelsForPlan(plan) : resolveModelsForPlan(plan);
    return models.temperature !== undefined ? models.temperature : 0.7;
}

module.exports = {
    AI_MODEL_TIERS,
    ASSISTANT_MODEL_TIERS,
    resolveModelsForPlan,
    resolveAssistantModelsForPlan,
    getModelForProvider,
    getMaxTokensForProvider,
    getTemperatureForPlan,
};
