/**
 * adminSupport.controller.js — Internal Support Ticket Management Controller
 *
 * Implements:
 * 1. Bounded, paginated queries for support tickets with multi-field search and filters.
 * 2. Summary status counters & urgent task tracking.
 * 3. Detailed inspection with customer thread history & private internal staff notes.
 * 4. Ticket assignment / re-assignment to administrators.
 * 5. Lifecycle status and priority state transitions.
 * 6. Admin responses dispatched to customer thread + email delivery notification.
 * 7. Admin Audit Trail recording for all administrative actions.
 */

'use strict';

const mongoose = require('mongoose');
const SupportTicket = require('../models/supportTicket.model');
const userModel = require('../models/user.model');
const auditLogService = require('../services/auditLog.service');
const emailService = require('../services/email.service');

const VALID_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'];
const VALID_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

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
 * @name getAdminSupportTicketsController
 * @route GET /api/admin/support/tickets
 * @access Private (Admin Only)
 */
async function getAdminSupportTicketsController(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const { status, priority, category, assignedTo, search, startDate, endDate } = req.query;

        const filter = {};

        // 1. Status Filter
        if (status && VALID_STATUSES.includes(status.toUpperCase())) {
            filter.status = status.toUpperCase();
        }

        // 2. Priority Filter
        if (priority && VALID_PRIORITIES.includes(priority)) {
            filter.priority = priority;
        }

        // 3. Category Filter
        if (category && category.trim()) {
            filter.category = category.trim();
        }

        // 4. Assigned Admin Filter
        if (assignedTo) {
            if (assignedTo === 'unassigned') {
                filter.assignedAdmin = null;
            } else if (mongoose.isValidObjectId(assignedTo)) {
                filter.assignedAdmin = new mongoose.Types.ObjectId(assignedTo);
            }
        }

        // 5. Date Range Filter
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate && !isNaN(new Date(startDate).getTime())) filter.createdAt.$gte = new Date(startDate);
            if (endDate && !isNaN(new Date(endDate).getTime())) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = e;
            }
        }

        // 6. Search Filter
        if (search && search.trim()) {
            const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(cleanSearch, 'i');
            filter.$or = [
                { ticketId: searchRegex },
                { email: searchRegex },
                { name: searchRegex },
                { subject: searchRegex }
            ];
        }

        const skip = (page - 1) * limit;

        // Perform parallel fetch of tickets, count, and summary counters
        const [tickets, total, metrics] = await Promise.all([
            SupportTicket.find(filter)
                .populate('assignedAdmin', 'username email role')
                .populate('userId', 'username email plan isDeleted')
                .select('ticketId name email category priority subject status assignedAdmin userId createdAt updatedAt')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            SupportTicket.countDocuments(filter),
            SupportTicket.aggregate([
                {
                    $group: {
                        _id: null,
                        totalTickets: { $sum: 1 },
                        openCount: { $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, 1, 0] } },
                        inProgressCount: { $sum: { $cond: [{ $eq: ['$status', 'IN_PROGRESS'] }, 1, 0] } },
                        waitingCount: { $sum: { $cond: [{ $eq: ['$status', 'WAITING_FOR_USER'] }, 1, 0] } },
                        resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } },
                        closedCount: { $sum: { $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0] } },
                        urgentCount: { $sum: { $cond: [{ $eq: ['$priority', 'Urgent'] }, 1, 0] } }
                    }
                }
            ])
        ]);

        const summary = metrics && metrics[0] ? metrics[0] : {
            totalTickets: total,
            openCount: 0,
            inProgressCount: 0,
            waitingCount: 0,
            resolvedCount: 0,
            closedCount: 0,
            urgentCount: 0
        };

        return res.status(200).json({
            success: true,
            tickets,
            summary,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit) || 1,
                limit
            }
        });
    } catch (err) {
        console.error('[getAdminSupportTicketsController] Error:', err.message);
        return res.status(500).json({ message: 'Failed to retrieve support tickets.' });
    }
}

/**
 * @name getAdminSupportTicketDetailsController
 * @route GET /api/admin/support/tickets/:ticketId
 * @access Private (Admin Only)
 */
async function getAdminSupportTicketDetailsController(req, res) {
    try {
        const { ticketId } = req.params;
        const query = mongoose.isValidObjectId(ticketId)
            ? { $or: [{ ticketId }, { _id: ticketId }] }
            : { ticketId };

        const ticket = await SupportTicket.findOne(query)
            .populate('assignedAdmin', 'username email role')
            .populate('userId', 'username email plan isBlocked isDeleted createdAt')
            .populate('internalNotes.authorId', 'username email')
            .lean();

        if (!ticket) {
            return res.status(404).json({ message: 'Support ticket not found.' });
        }

        return res.status(200).json({
            success: true,
            ticket
        });
    } catch (err) {
        console.error('[getAdminSupportTicketDetailsController] Error:', err.message);
        return res.status(500).json({ message: 'Failed to retrieve ticket details.' });
    }
}

/**
 * @name assignAdminSupportTicketController
 * @route PATCH /api/admin/support/tickets/:ticketId/assign
 * @access Private (Admin Only)
 */
async function assignAdminSupportTicketController(req, res) {
    try {
        const { ticketId } = req.params;
        const { assignedAdminId, reason } = req.body || {};

        const query = mongoose.isValidObjectId(ticketId)
            ? { $or: [{ ticketId }, { _id: ticketId }] }
            : { ticketId };

        const ticket = await SupportTicket.findOne(query);
        if (!ticket) {
            return res.status(404).json({ message: 'Support ticket not found.' });
        }

        let assignedUser = null;
        if (assignedAdminId) {
            if (!mongoose.isValidObjectId(assignedAdminId)) {
                return res.status(400).json({ message: 'Invalid Admin User ID format.' });
            }
            assignedUser = await userModel.findById(assignedAdminId).select('username email role isBlocked isDeleted');
            if (!assignedUser || (!assignedUser.isAdmin && !['admin', 'super_admin'].includes(assignedUser.role))) {
                return res.status(400).json({ message: 'Target user is not an active administrator.' });
            }
            ticket.assignedAdmin = assignedUser._id;
        } else {
            ticket.assignedAdmin = null;
        }

        await ticket.save();

        const assignSummary = assignedUser
            ? `Assigned ticket ${ticket.ticketId} to "${assignedUser.username}".`
            : `Unassigned ticket ${ticket.ticketId}.`;

        // Record Audit Log
        await auditLogService.recordAdminAudit({
            req,
            action: 'TICKET_ASSIGNED',
            category: 'ADMIN',
            severity: 'INFO',
            targetId: ticket._id,
            targetType: 'SupportTicket',
            targetIdentifier: `${ticket.ticketId} (${ticket.email})`,
            changeSummary: `Administrator "${req.user.username}" updated ticket assignment: ${assignSummary}`,
            reason: reason || 'Ticket triage and assignment'
        });

        return res.status(200).json({
            success: true,
            message: assignSummary,
            ticket: {
                ticketId: ticket.ticketId,
                assignedAdmin: assignedUser ? { _id: assignedUser._id, username: assignedUser.username, email: assignedUser.email } : null,
                updatedAt: ticket.updatedAt
            }
        });
    } catch (err) {
        console.error('[assignAdminSupportTicketController] Error:', err.message);
        return res.status(500).json({ message: 'Failed to update ticket assignment.' });
    }
}

/**
 * @name updateAdminSupportTicketStatusController
 * @route PATCH /api/admin/support/tickets/:ticketId/status
 * @access Private (Admin Only)
 */
async function updateAdminSupportTicketStatusController(req, res) {
    try {
        const { ticketId } = req.params;
        const { status, priority, reason } = req.body || {};

        const query = mongoose.isValidObjectId(ticketId)
            ? { $or: [{ ticketId }, { _id: ticketId }] }
            : { ticketId };

        const ticket = await SupportTicket.findOne(query);
        if (!ticket) {
            return res.status(404).json({ message: 'Support ticket not found.' });
        }

        const changes = [];

        if (status) {
            const upperStatus = status.toUpperCase();
            if (!VALID_STATUSES.includes(upperStatus)) {
                return res.status(400).json({ message: `Invalid status "${status}". Allowed: ${VALID_STATUSES.join(', ')}` });
            }
            if (ticket.status !== upperStatus) {
                changes.push(`status: ${ticket.status} -> ${upperStatus}`);
                ticket.status = upperStatus;
            }
        }

        if (priority) {
            if (!VALID_PRIORITIES.includes(priority)) {
                return res.status(400).json({ message: `Invalid priority "${priority}". Allowed: ${VALID_PRIORITIES.join(', ')}` });
            }
            if (ticket.priority !== priority) {
                changes.push(`priority: ${ticket.priority} -> ${priority}`);
                ticket.priority = priority;
            }
        }

        if (changes.length === 0) {
            return res.status(200).json({ success: true, message: 'No changes detected.', ticket });
        }

        await ticket.save();

        const changeDescription = changes.join(', ');

        // Record Audit Log
        await auditLogService.recordAdminAudit({
            req,
            action: 'TICKET_STATUS_UPDATED',
            category: 'ADMIN',
            severity: 'INFO',
            targetId: ticket._id,
            targetType: 'SupportTicket',
            targetIdentifier: `${ticket.ticketId} (${ticket.email})`,
            changeSummary: `Administrator "${req.user.username}" modified ticket (${changeDescription}).`,
            reason: reason || 'Status transition'
        });

        return res.status(200).json({
            success: true,
            message: `Ticket updated: ${changeDescription}`,
            ticket: {
                ticketId: ticket.ticketId,
                status: ticket.status,
                priority: ticket.priority,
                updatedAt: ticket.updatedAt
            }
        });
    } catch (err) {
        console.error('[updateAdminSupportTicketStatusController] Error:', err.message);
        return res.status(500).json({ message: 'Failed to update ticket status or priority.' });
    }
}

/**
 * @name addAdminInternalNoteController
 * @route POST /api/admin/support/tickets/:ticketId/notes
 * @access Private (Admin Only)
 */
async function addAdminInternalNoteController(req, res) {
    try {
        const { ticketId } = req.params;
        const { note } = req.body || {};

        const cleanNote = typeof note === 'string' ? note.trim() : '';
        if (!cleanNote || cleanNote.length < 2 || cleanNote.length > 5000) {
            return res.status(400).json({ message: 'Internal note must be between 2 and 5,000 characters.' });
        }

        const query = mongoose.isValidObjectId(ticketId)
            ? { $or: [{ ticketId }, { _id: ticketId }] }
            : { ticketId };

        const ticket = await SupportTicket.findOne(query);
        if (!ticket) {
            return res.status(404).json({ message: 'Support ticket not found.' });
        }

        const newNote = {
            authorId: req.user._id,
            authorName: req.user.username || 'Admin Staff',
            note: sanitizeText(cleanNote),
            createdAt: new Date()
        };

        ticket.internalNotes.push(newNote);
        await ticket.save();

        // Record Audit Log
        await auditLogService.recordAdminAudit({
            req,
            action: 'TICKET_NOTE_ADDED',
            category: 'ADMIN',
            severity: 'INFO',
            targetId: ticket._id,
            targetType: 'SupportTicket',
            targetIdentifier: `${ticket.ticketId} (${ticket.email})`,
            changeSummary: `Administrator "${req.user.username}" added an internal note to ticket ${ticket.ticketId}.`
        });

        return res.status(201).json({
            success: true,
            message: 'Internal note added successfully.',
            internalNotes: ticket.internalNotes
        });
    } catch (err) {
        console.error('[addAdminInternalNoteController] Error:', err.message);
        return res.status(500).json({ message: 'Failed to add internal note.' });
    }
}

/**
 * @name replyAdminSupportTicketController
 * @route POST /api/admin/support/tickets/:ticketId/reply
 * @access Private (Admin Only)
 */
async function replyAdminSupportTicketController(req, res) {
    try {
        const { ticketId } = req.params;
        const { message, status, sendEmail = true } = req.body || {};

        const cleanMessage = typeof message === 'string' ? message.trim() : '';
        if (!cleanMessage || cleanMessage.length < 2 || cleanMessage.length > 5000) {
            return res.status(400).json({ message: 'Reply message must be between 2 and 5,000 characters.' });
        }

        const query = mongoose.isValidObjectId(ticketId)
            ? { $or: [{ ticketId }, { _id: ticketId }] }
            : { ticketId };

        const ticket = await SupportTicket.findOne(query);
        if (!ticket) {
            return res.status(404).json({ message: 'Support ticket not found.' });
        }

        const sanitized = sanitizeText(cleanMessage);

        ticket.responseHistory.push({
            senderType: 'admin',
            senderId: req.user._id,
            senderName: req.user.username || 'KIVI Support',
            message: sanitized,
            createdAt: new Date()
        });

        // Set status to WAITING_FOR_USER by default, or admin-specified status
        if (status && VALID_STATUSES.includes(status.toUpperCase())) {
            ticket.status = status.toUpperCase();
        } else {
            ticket.status = 'WAITING_FOR_USER';
        }

        await ticket.save();

        // Non-blocking user email notification dispatch
        let emailDelivered = false;
        if (sendEmail !== false && ticket.email) {
            try {
                const mailRes = await emailService.sendSupportReplyEmail(ticket.email, {
                    ticketId: ticket.ticketId,
                    subject: ticket.subject,
                    replyMessage: cleanMessage,
                    adminName: req.user.username
                });
                emailDelivered = mailRes && mailRes.success;
            } catch (mailErr) {
                console.warn('[replyAdminSupportTicketController] Email dispatch notice:', mailErr.message);
            }
        }

        // Record Audit Log
        await auditLogService.recordAdminAudit({
            req,
            action: 'TICKET_REPLIED',
            category: 'ADMIN',
            severity: 'INFO',
            targetId: ticket._id,
            targetType: 'SupportTicket',
            targetIdentifier: `${ticket.ticketId} (${ticket.email})`,
            changeSummary: `Administrator "${req.user.username}" sent a customer response on ticket ${ticket.ticketId} (Status: ${ticket.status}, Email: ${emailDelivered ? 'sent' : 'skipped/pending'}).`
        });

        return res.status(200).json({
            success: true,
            message: 'Response posted to ticket successfully.',
            emailDelivered,
            ticket: {
                ticketId: ticket.ticketId,
                status: ticket.status,
                updatedAt: ticket.updatedAt,
                responseHistory: ticket.responseHistory
            }
        });
    } catch (err) {
        console.error('[replyAdminSupportTicketController] Error:', err.message);
        return res.status(500).json({ message: 'Failed to post response to customer.' });
    }
}

module.exports = {
    getAdminSupportTicketsController,
    getAdminSupportTicketDetailsController,
    assignAdminSupportTicketController,
    updateAdminSupportTicketStatusController,
    addAdminInternalNoteController,
    replyAdminSupportTicketController
};
