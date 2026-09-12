const express = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const { createTieredRateLimiter } = require('../middleware/rateLimiter.middleware');
const { chatAssistantController } = require('../controller/assistant.controller');

const assistantRouter = express.Router();

const aiAssistantTieredLimiter = createTieredRateLimiter({
    prefix: 'ratelimit:ai-assistant',
    windowSeconds: 86400, // 24-hour daily limit
    limits: { free: 10, pro: 100, premium: 500 },
    bonusMultiplier: 3,
    message: 'AI Assistant daily limit reached for your plan.'
});

const checkAiAssistantAccess = (req, res, next) => {
    if (req.user?.blockedFeatures?.aiAssistant) {
        return res.status(403).json({ message: "AI Assistant access has been disabled for your account by an administrator. ❌" });
    }
    next();
};

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
    chatAssistantController
);

module.exports = assistantRouter;
