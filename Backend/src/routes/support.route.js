'use strict';

const express = require('express');
const { 
    contactUsController, 
    supportTicketController, 
    getUserTicketsController,
    getUserTicketDetailsController,
    replyUserTicketController,
    newsletterSubscriptionController 
} = require('../controller/support.controller');
const { authUser, optionalAuth } = require('../middleware/auth.middleware');
const { createRateLimiter } = require('../middleware/rateLimiter.middleware');
const { createModerationFilter } = require('../middleware/moderation.middleware');

const supportRouter = express.Router();

// Abuse protection: limit submissions to 5 per minute per IP
const supportRateLimiter = createRateLimiter({
    prefix: 'ratelimit:support',
    windowSeconds: 60,
    maxRequests: 5,
    message: 'Too many requests. Please wait a minute before submitting again.'
});

const supportModerationFilter = createModerationFilter({ fields: ['subject', 'message'], contentType: 'support_ticket' });

// Contact Us endpoint
supportRouter.post('/contact', supportRateLimiter, supportModerationFilter, contactUsController);

// Support Ticket submission endpoint (supports guest or authenticated user)
supportRouter.post('/ticket', optionalAuth, supportRateLimiter, supportModerationFilter, supportTicketController);

// Candidate / User ticket management endpoints
supportRouter.get('/my-tickets', authUser, getUserTicketsController);
supportRouter.get('/my-tickets/:ticketId', authUser, getUserTicketDetailsController);
supportRouter.post('/my-tickets/:ticketId/reply', authUser, supportRateLimiter, replyUserTicketController);

// Newsletter Subscription endpoint
supportRouter.post('/newsletter', supportRateLimiter, newsletterSubscriptionController);

// Root alias for /api/contact compatibility
supportRouter.post('/', supportRateLimiter, contactUsController);

module.exports = supportRouter;
