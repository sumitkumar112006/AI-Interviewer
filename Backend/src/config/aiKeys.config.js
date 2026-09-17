const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
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
    process.env.GROQ_API_KEY,               // Key 1 (Primary Priority)
    process.env.PRINCE_GROQ_API,            // Key 2
    process.env.SAURABH_GROQ_API,           // Key 3
    process.env.SAURABH_SECOND_GROQ_API,    // Key 4
    process.env.SUMIT_KUMAR_GROQ_API_KEY,   // Key 5
    process.env.WEB_BUSSINESS_GROQ_API,     // Key 6
    process.env['SUMIT-1_GROQ_API_KEY'],    // Key 7
    process.env['KIVI-SUMIT-2_GROQ_API_KEY'],// Key 8
];

const GEMINI_API_KEYS = [
    process.env.PRINCE_GENAI_API_KEY,       // Key 1 (Primary Gemini)
    process.env.SK_SG_GENAI_API_KEY,        // Key 2
    process.env.SAURABH_GEMINI_API_KEY,     // Key 3
    process.env.INDONESIAKA_GENAI_API_KEY,  // Key 4
    process.env.AMIT_KUMAR_GENAI_API_KEY,   // Key 5
    process.env['KIVI-SUMIT_GEMINI_API_KEY'],// Key 6
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
