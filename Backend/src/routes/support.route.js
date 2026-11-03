const express = require('express');
const { contactUsController, supportTicketController, newsletterSubscriptionController } = require('../controller/support.controller');
const { createRateLimiter } = require('../middleware/rateLimiter.middleware');

const supportRouter = express.Router();

// Abuse protection: limit submissions to 5 per minute per IP
const supportRateLimiter = createRateLimiter({
    prefix: 'ratelimit:support',
    windowSeconds: 60,
    maxRequests: 5,
    message: 'Too many requests. Please wait a minute before submitting again.'
});

// Contact Us endpoint
supportRouter.post('/contact', supportRateLimiter, contactUsController);

// Support Ticket endpoint
supportRouter.post('/ticket', supportRateLimiter, supportTicketController);

// Newsletter Subscription endpoint
supportRouter.post('/newsletter', supportRateLimiter, newsletterSubscriptionController);

// Root alias for /api/contact compatibility
supportRouter.post('/', supportRateLimiter, contactUsController);

module.exports = supportRouter;
