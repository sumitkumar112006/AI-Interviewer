const { sendToWeb3Forms } = require('../services/web3forms.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

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
 * Handle Support Ticket submissions
 * @route POST /api/support/ticket
 */
async function supportTicketController(req, res) {
    try {
        const { name, email, category, priority, subject, message } = req.body || {};

        const trimmedName = typeof name === 'string' ? name.trim() : '';
        const trimmedEmail = typeof email === 'string' ? email.trim() : '';
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

        // Notice: strictly omit any user_id, mongo ObjectId, or user plan to prevent information leakage
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
    newsletterSubscriptionController
};
