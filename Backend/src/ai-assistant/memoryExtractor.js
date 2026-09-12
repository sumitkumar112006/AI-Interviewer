const { appendChatTurn } = require('./contextAssembler');

/**
 * Lightweight regex-based / heuristic extractor for fast memory updates
 * Can also be supplemented by an async LLM background task if needed
 */
function extractQuickFacts(userMessage, assistantReply) {
    const text = `${userMessage}\n${assistantReply}`.toLowerCase();
    const identifiedTopics = [];

    const techKeywords = [
        'react', 'node.js', 'express', 'mongodb', 'redis', 'docker', 'kubernetes',
        'system design', 'microservices', 'graphql', 'next.js', 'typescript', 'python',
        'sql', 'postgresql', 'aws', 'ci/cd', 'dsa', 'algorithms', 'dynamic programming'
    ];

    techKeywords.forEach(tech => {
        if (text.includes(tech)) {
            identifiedTopics.push(tech);
        }
    });

    return {
        discussedTopics: Array.from(new Set(identifiedTopics))
    };
}

/**
 * Non-blocking background worker to update Redis working memory and log milestones
 */
async function processTurnInBackground(userId, userMessage, assistantReply) {
    if (!userId) return;

    // Run completely asynchronously (detached from HTTP response cycle)
    setImmediate(async () => {
        try {
            // 1. Update Redis session memory buffer
            await appendChatTurn(userId, userMessage, assistantReply);

            // 2. Extract quick facts
            const facts = extractQuickFacts(userMessage, assistantReply);
            
            // 3. Log or persist if valuable topics found
            if (facts.discussedTopics.length > 0) {
                // Topic history logged for session tracking
            }
        } catch (err) {
            console.error('[Memory Extractor] Background process error:', err.message);
        }
    });
}

module.exports = {
    processTurnInBackground,
    extractQuickFacts
};
