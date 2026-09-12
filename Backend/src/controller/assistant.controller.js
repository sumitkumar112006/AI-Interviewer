const { streamAssistantChat, processAssistantChat } = require('../ai-assistant');

/**
 * Controller for KIVI AI Assistant Chat
 * Supports Real-Time SSE Token Streaming (sub-200ms initial response)
 * Endpoint: POST /api/assistant/chat
 */
async function chatAssistantController(req, res, next) {
    try {
        const userId = req.user?._id || req.user?.id;
        const userPlan = req.user?.plan || 'free';
        const { reportId, message, selectedText, action, instruction, stream = true } = req.body;

        if (!message && !selectedText && !instruction) {
            return res.status(400).json({ message: 'A prompt message, instruction, or highlighted snippet is required.' });
        }

        const wantsStreaming = stream !== false;

        if (wantsStreaming) {
            // Set SSE Headers
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering for Nginx/Cloudflare
            if (typeof res.flushHeaders === 'function') {
                res.flushHeaders();
            }

            // Keep connection alive with initial ping/comment
            res.write(': keepalive\n\n');

            let clientAborted = false;
            req.on('close', () => {
                clientAborted = true;
            });

            try {
                const result = await streamAssistantChat({
                    userId,
                    reportId,
                    message,
                    selectedText,
                    action,
                    instruction,
                    userPlan,
                    onToken: (token) => {
                        if (!clientAborted) {
                            res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
                        }
                    }
                });

                if (!clientAborted) {
                    res.write(`data: ${JSON.stringify({
                        type: 'done',
                        reply: result.reply,
                        suggestedSnippet: result.suggestedSnippet,
                        resources: result.resources,
                        profile: result.candidateProfile
                    })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                }
            } catch (streamErr) {
                console.error('[Assistant Controller] Streaming error:', streamErr.message);
                if (!clientAborted) {
                    res.write(`data: ${JSON.stringify({
                        type: 'error',
                        message: streamErr.message || 'Error occurred during AI streaming.'
                    })}\n\n`);
                    res.end();
                }
            }
        } else {
            // Standard JSON response
            const result = await processAssistantChat({
                userId,
                reportId,
                message,
                selectedText,
                action,
                instruction,
                userPlan
            });

            return res.status(200).json(result);
        }
    } catch (err) {
        console.error('[Assistant Controller] Chat error:', err);
        return res.status(500).json({ message: err.message || 'Internal AI assistant error' });
    }
}

module.exports = {
    chatAssistantController
};
