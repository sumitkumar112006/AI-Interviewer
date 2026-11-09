'use strict';

const mongoose = require('mongoose');
const { sendToWeb3Forms } = require('../services/web3forms.service');
const SupportTicket = require('../models/supportTicket.model');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

/**
 * Basic HTML escaping helper to prevent stored XSS attacks
 */
function sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Handle Contact Us form submissions
 * @route POST /api/support/contact or POST /api/contact
 */
async function contactUsController(req, res) {
    try {
        const { name, email, category, message } = req.body || {};

        const trimmedName = typeof name === 'string' ? name.trim() : '';
        const trimmedEmail = typeof email === 'string' ? email.trim() : '';
        const trimmedCategory = typeof category === 'string' ? category.trim() : 'General Inquiry';
        const trimmedMessage = typeof message === 'string' ? message.trim() : '';

        if (!trimmedName || trimmedName.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Name is required and must not exceed 100 characters.'
            });
        }

        if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 150) {
            return res.status(400).json({
                success: false,
                message: 'A valid email address is required.'
            });
        }

        if (!trimmedMessage || trimmedMessage.length < 3 || trimmedMessage.length > 5000) {
            return res.status(400).json({
                success: false,
                message: 'Message must be between 3 and 5,000 characters.'
            });
        }

        const safeCategory = trimmedCategory.slice(0, 100) || 'General Inquiry';
        const subject = `[KIVI-AI Contact] ${safeCategory} from ${trimmedName}`;

        const result = await sendToWeb3Forms({
            name: trimmedName,
            email: trimmedEmail,
            category: safeCategory,
            subject,
            message: trimmedMessage,
            from_name: 'KIVI-AI Contact Form'
        });

        if (!result.success) {
            return res.status(502).json({
                success: false,
                message: result.message || 'Unable to deliver your message at this time. Please try again later.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Your message has been sent successfully. We will get back to you shortly.'
        });
    } catch (err) {
        console.error('[contactUsController] Error:', err.message || 'Internal error');
        return res.status(500).json({
            success: false,
            message: 'An internal server error occurred while sending your message.'
        });
    }
}

/**
 * Handle Support Ticket submissions (Authenticated or Guest)
 * @route POST /api/support/ticket
 */
async function supportTicketController(req, res) {
    try {
        const { name, email, category, priority, subject, message } = req.body || {};

        const trimmedName = typeof name === 'string' ? name.trim() : '';
        const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const trimmedCategory = typeof category === 'string' ? category.trim() : 'Technical Bug / Issue';
        const rawPriority = typeof priority === 'string' ? priority.trim() : 'Normal';
        const safePriority = ALLOWED_PRIORITIES.includes(rawPriority) ? rawPriority : 'Normal';
        const trimmedSubject = typeof subject === 'string' ? subject.trim().slice(0, 200) : '';
        const trimmedMessage = typeof message === 'string' ? message.trim() : '';

        if (!trimmedName || trimmedName.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Name is required and must not exceed 100 characters.'
            });
        }

        if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 150) {
            return res.status(400).json({
                success: false,
                message: 'A valid email address is required.'
            });
        }

        if (!trimmedMessage || trimmedMessage.length < 3 || trimmedMessage.length > 5000) {
            return res.status(400).json({
                success: false,
                message: 'Message must be between 3 and 5,000 characters.'
            });
        }

        const safeCategory = trimmedCategory.slice(0, 100) || 'General Support';
        const ticketId = `KIVI-SUP-${Math.floor(100000 + Math.random() * 900000)}`;
        const emailSubject = `[Support Ticket ${ticketId}] [${safePriority}] ${safeCategory}: ${trimmedSubject || 'Support Request'}`;

        // Notice: strictly omit any user_id, mongo ObjectId, or user plan from Web3Forms to prevent information leakage
        const result = await sendToWeb3Forms({
            name: trimmedName,
            email: trimmedEmail,
            subject: emailSubject,
            category: safeCategory,
            priority: safePriority,
            ticket_id: ticketId,
            message: trimmedMessage,
            from_name: 'KIVI-AI Support Portal'
        });

        if (!result.success) {
            return res.status(502).json({
                success: false,
                message: result.message || 'Unable to submit support ticket at this time. Please try again later.'
            });
        }

        // Persist ticket in DB for administrative tracking, user history, compliance, and export
        try {
            if (mongoose.connection && mongoose.connection.readyState === 1) {
                const authenticatedUserId = req.user ? req.user._id : null;
                const cleanMsg = sanitizeText(trimmedMessage);

                await SupportTicket.create({
                    ticketId,
                    userId: authenticatedUserId,
                    name: trimmedName,
                    email: trimmedEmail,
                    category: safeCategory,
                    priority: safePriority,
                    subject: trimmedSubject || 'Support Request',
                    message: cleanMsg,
                    status: 'OPEN',
                    responseHistory: [
                        {
                            senderType: 'user',
                            senderId: authenticatedUserId,
                            senderName: trimmedName,
                            message: cleanMsg,
                            createdAt: new Date()
                        }
                    ]
                });
            }
        } catch (dbErr) {
            console.warn('[supportTicketController] DB persist notice:', dbErr.message);
        }

        return res.status(200).json({
            success: true,
            ticketId,
            message: 'Support ticket submitted successfully.'
        });
    } catch (err) {
        console.error('[supportTicketController] Error:', err.message || 'Internal error');
        return res.status(500).json({
            success: false,
            message: 'An internal server error occurred while creating your support ticket.'
        });
    }
}

/**
 * Handle Candidate / User listing their own submitted tickets
 * @route GET /api/support/my-tickets
 * @access Private (Authenticated User)
 */
async function getUserTicketsController(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required to view your tickets.' });
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const { status } = req.query;

        const query = {
            $or: [
                { userId: req.user._id },
                { email: req.user.email?.toLowerCase() }
            ]
        };

        if (status && ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'].includes(status.toUpperCase())) {
            query.status = status.toUpperCase();
        }

        const skip = (page - 1) * limit;

        const [tickets, total] = await Promise.all([
            SupportTicket.find(query)
                .select('ticketId subject category priority status createdAt updatedAt')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            SupportTicket.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            tickets,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit) || 1,
                limit
            }
        });
    } catch (err) {
        console.error('[getUserTicketsController] Error:', err.message);
        return res.status(500).json({ message: 'Failed to retrieve your support tickets.' });
    }
}

/**
 * Handle Candidate viewing a single ticket with response history
 * @route GET /api/support/my-tickets/:ticketId
 * @access Private (Authenticated User, Owner Only)
 */
async function getUserTicketDetailsController(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        const { ticketId } = req.params;
        const ticket = await SupportTicket.findOne({ ticketId })
            .select('-internalNotes') // Strict security: Never expose internal notes to candidates
            .lean();

        if (!ticket) {
            return res.status(404).json({ message: 'Support ticket not found.' });
        }

        // Verify ownership
        const isOwner = (ticket.userId && ticket.userId.toString() === req.user._id.toString()) ||
                        (ticket.email && ticket.email.toLowerCase() === req.user.email?.toLowerCase());

        if (!isOwner && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Access denied. You can only view your own support tickets.' });
        }

        return res.status(200).json({
            success: true,
            ticket
        });
    } catch (err) {
        console.error('[getUserTicketDetailsController] Error:', err.message);
        return res.status(500).json({ message: 'Failed to retrieve ticket details.' });
    }
}

/**
 * Handle Candidate replying to their existing ticket
 * @route POST /api/support/my-tickets/:ticketId/reply
 * @access Private (Authenticated User, Owner Only)
 */
async function replyUserTicketController(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        const { ticketId } = req.params;
        const { message } = req.body || {};

        const cleanMessage = typeof message === 'string' ? message.trim() : '';
        if (!cleanMessage || cleanMessage.length < 2 || cleanMessage.length > 5000) {
            return res.status(400).json({ message: 'Reply message must be between 2 and 5,000 characters.' });
        }

        const ticket = await SupportTicket.findOne({ ticketId });
        if (!ticket) {
            return res.status(404).json({ message: 'Support ticket not found.' });
        }

        // Verify ownership
        const isOwner = (ticket.userId && ticket.userId.toString() === req.user._id.toString()) ||
                        (ticket.email && ticket.email.toLowerCase() === req.user.email?.toLowerCase());

        if (!isOwner && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Access denied. You can only reply to your own tickets.' });
        }

        const sanitized = sanitizeText(cleanMessage);

        ticket.responseHistory.push({
            senderType: 'user',
            senderId: req.user._id,
            senderName: req.user.username || 'Candidate',
            message: sanitized,
            createdAt: new Date()
        });

        // Re-open ticket if it was resolved/closed or mark in progress
        if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
            ticket.status = 'OPEN';
        } else {
            ticket.status = 'IN_PROGRESS';
        }

        await ticket.save();

        return res.status(200).json({
            success: true,
            message: 'Your reply has been added to the ticket.',
            ticket: {
                ticketId: ticket.ticketId,
                status: ticket.status,
                updatedAt: ticket.updatedAt,
                responseHistory: ticket.responseHistory
            }
        });
    } catch (err) {
        console.error('[replyUserTicketController] Error:', err.message);
        return res.status(500).json({ message: 'Failed to post reply to support ticket.' });
    }
}

/**
 * Handle Newsletter Subscription
 * @route POST /api/support/newsletter
 */
async function newsletterSubscriptionController(req, res) {
    try {
        const { email } = req.body || {};
        const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

        if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 150) {
            return res.status(400).json({
                success: false,
                message: 'A valid email address is required.'
            });
        }

        // Notify via Web3Forms (server-side, non-blocking failure)
        await sendToWeb3Forms({
            name: 'Newsletter Subscriber',
            email: trimmedEmail,
            category: 'Newsletter Subscription',
            subject: `[KIVI-AI Newsletter] New subscriber: ${trimmedEmail}`,
            message: `User ${trimmedEmail} subscribed to the KIVI AI tech market newsletter.`,
            from_name: 'KIVI-AI Newsletter'
        }).catch(() => ({}));

        return res.status(200).json({
            success: true,
            message: 'Thank you for subscribing to the KIVI AI newsletter!'
        });
    } catch (err) {
        console.error('[newsletterSubscriptionController] Error:', err.message || 'Internal error');
        return res.status(500).json({
            success: false,
            message: 'An internal error occurred while processing your subscription.'
        });
    }
}

module.exports = {
    contactUsController,
    supportTicketController,
    getUserTicketsController,
    getUserTicketDetailsController,
    replyUserTicketController,
    newsletterSubscriptionController
};
