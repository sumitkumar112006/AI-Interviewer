require('dotenv').config();

/**
 * ==============================================================================
 * 🔑 CENTRAL AI API KEYS POOL
 * ==============================================================================
 * Add your API keys in priority order below (Key 1 -> Key 2 -> Key 3).
 * When a request arrives, the system always starts with Key 1.
 * If Key 1 is rate-limited (HTTP 429), it automatically fails over to Key 2,
 * then Key 3 in the exact same request.
 * 
 * To add more keys, just add a new item to GROQ_API_KEYS or GEMINI_API_KEYS!
 * ==============================================================================
 */

const GROQ_API_KEYS = [
    process.env.GROQ_API_KEY,      // Key 1 (Primary Priority)
    process.env.PRINCE_GROQ_API,   // Key 2 (Secondary Priority)
    process.env.SAURABH_GROQ_API,  // Key 3 (Tertiary Priority)
    // 👉 Add additional Groq keys here anytime:
    // process.env.GROQ_API_KEY_4,
    // "gsk_...",
];

const GEMINI_API_KEYS = [
    process.env.PRINCE_GENAI_API_KEY,  // Key 1 (Primary Gemini)
    process.env.SK_SG_GENAI_API_KEY,  // Key 2 (Secondary Priority)
    process.env.INDONESIAKA_GENAI_API_KEY,  // Key 3 (Secondary Priority)
    process.env.AMIT_KUMAR_GENAI_API_KEY,  // Key 4 (Secondary Priority)
    // 👉 Add additional Gemini keys here anytime:
    // process.env.GOOGLE_GENAI_API_KEY_2,
    // "AIzaSy...",
];

const OPENROUTER_API_KEYS = [
    process.env.OPENROUTER_API_KEY,
];

/**
 * Initializes and returns the active priority pool of managed Groq keys.
 */
function getManagedGroqPool() {
    return GROQ_API_KEYS
        .filter(k => typeof k === 'string' && k.trim().length > 0)
        .map((key, index) => ({
            id: index + 1,
            key: key.trim(),
            cooldownUntil: 0
        }));
}

/**
 * Initializes and returns the active priority pool of managed Gemini keys.
 */
function getManagedGeminiPool() {
    return GEMINI_API_KEYS
        .filter(k => typeof k === 'string' && k.trim().length > 0)
        .map((key, index) => ({
            id: index + 1,
            key: key.trim(),
            cooldownUntil: 0
        }));
}

module.exports = {
    GROQ_API_KEYS,
    GEMINI_API_KEYS,
    OPENROUTER_API_KEYS,
    getManagedGroqPool,
    getManagedGeminiPool
};
