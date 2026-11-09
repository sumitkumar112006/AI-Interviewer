const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { createTieredRateLimiter } = require('../middleware/rateLimiter.middleware');
const { enforceFeatureAccess } = require('../middleware/appSettings.middleware');
const { createModerationFilter } = require('../middleware/moderation.middleware');
const {
    chatAssistantController,
    getAssistantHistoryController,
    clearAssistantHistoryController
} = require('../controller/assistant.controller');

const assistantRouter = express.Router();

const aiAssistantTieredLimiter = createTieredRateLimiter({
    prefix: 'ratelimit:ai-assistant',
    windowSeconds: 86400, // 24-hour daily limit
    limits: { free: 500, pro: 500, premium: 500 },
    bonusMultiplier: 3,
    message: 'AI Assistant daily limit reached for your plan.'
});

const checkAiAssistantAccess = enforceFeatureAccess('aiAssistant');
const assistantModerationFilter = createModerationFilter({ fields: ['message', 'promptText'], contentType: 'assistant_message' });

/**
 * @route POST /api/assistant/chat
 * @description Real-time SSE token streaming assistant endpoint for KIVI AI Copilot
 * @access private
 */
assistantRouter.post(
    '/chat',
    authMiddleware.authUser,
    checkAiAssistantAccess,
    aiAssistantTieredLimiter,
    assistantModerationFilter,
    chatAssistantController
);

/**
 * @route GET /api/assistant/history
 * @description Get current session history from Redis
 */
assistantRouter.get(
    '/history',
    authMiddleware.authUser,
    checkAiAssistantAccess,
    getAssistantHistoryController
);

/**
 * @route DELETE /api/assistant/history
 * @description Clear assistant session history
 */
assistantRouter.delete(
    '/history',
    authMiddleware.authUser,
    checkAiAssistantAccess,
    clearAssistantHistoryController
);

module.exports = assistantRouter;
