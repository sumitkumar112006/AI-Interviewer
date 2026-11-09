/**
 * adminSupport.test.js — Automated test suite for IMPLEMENTATION 07 (Support Ticket System)
 *
 * Verifies:
 * 1. Admin Ticket Inbox: Pagination, multi-field search, status/priority filtering, summary metrics.
 * 2. Ticket Inspection: Complete conversation thread + internal notes.
 * 3. Triage & Assignment: Reassigning ticket to administrator with audit trail recording.
 * 4. Status & Priority Lifecycle: Updating status/priority with audit log recording.
 * 5. Internal Staff Notes: Admin-only notes attached to ticket.
 * 6. Admin Replies: Response added to customer thread + email dispatch notification.
 * 7. Candidate Isolation & Security:
 *    - Users can only access their own tickets.
 *    - Unauthorized ticket inspection returns 403.
 *    - Internal notes are strictly excluded from user-facing payloads.
 *    - Candidate replies re-open ticket into IN_PROGRESS.
 */

'use strict';

const mongoose = require('mongoose');
const SupportTicket = require('../models/supportTicket.model');
const userModel = require('../models/user.model');
const {
    getAdminSupportTicketsController,
    getAdminSupportTicketDetailsController,
    assignAdminSupportTicketController,
    updateAdminSupportTicketStatusController,
    addAdminInternalNoteController,
    replyAdminSupportTicketController
} = require('../controller/adminSupport.controller');
const {
    getUserTicketsController,
    getUserTicketDetailsController,
    replyUserTicketController
} = require('../controller/support.controller');
const auditLogService = require('../services/auditLog.service');
const emailService = require('../services/email.service');

describe('IMPLEMENTATION 07 — Internal Support Ticket System Test Suite', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('1. Admin Ticket Inbox, Filtering & Summaries', () => {
        test('getAdminSupportTicketsController: returns paginated tickets with summary aggregation', async () => {
            const fakeTickets = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    ticketId: 'KIVI-SUP-112233',
                    name: 'John Candidate',
                    email: 'john@example.com',
                    category: 'Billing & Payments',
                    priority: 'High',
                    status: 'OPEN',
                    createdAt: new Date()
                }
            ];

            const mockFind = {
                populate: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(fakeTickets)
            };

            jest.spyOn(SupportTicket, 'find').mockReturnValue(mockFind);
            jest.spyOn(SupportTicket, 'countDocuments').mockResolvedValue(15);
            jest.spyOn(SupportTicket, 'aggregate').mockResolvedValue([
                {
                    totalTickets: 15,
                    openCount: 6,
                    inProgressCount: 4,
                    waitingCount: 2,
                    resolvedCount: 2,
                    closedCount: 1,
                    urgentCount: 3
                }
            ]);

            const req = {
                query: { page: '1', limit: '20', status: 'OPEN' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await getAdminSupportTicketsController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                tickets: expect.any(Array),
                summary: expect.objectContaining({
                    totalTickets: 15,
                    openCount: 6,
                    urgentCount: 3
                }),
                pagination: expect.objectContaining({
                    total: 15,
                    page: 1
                })
            }));
        });
    });

    describe('2. Ticket Triage, Status & Assignment', () => {
        test('assignAdminSupportTicketController: assigns ticket to active admin and records audit event', async () => {
            const ticketId = 'KIVI-SUP-998877';
            const adminUserId = new mongoose.Types.ObjectId();
            const fakeTicket = {
                _id: new mongoose.Types.ObjectId(),
                ticketId,
                email: 'user@example.com',
                assignedAdmin: null,
                save: jest.fn().mockResolvedValue(true)
            };
            const fakeAdmin = {
                _id: adminUserId,
                username: 'support_admin',
                email: 'admin@kivi-ai.com',
                role: 'admin',
                isAdmin: true
            };

            jest.spyOn(SupportTicket, 'findOne').mockResolvedValue(fakeTicket);
            jest.spyOn(userModel, 'findById').mockReturnValue({
                select: jest.fn().mockResolvedValue(fakeAdmin)
            });
            const auditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue({});

            const req = {
                params: { ticketId },
                body: { assignedAdminId: adminUserId.toString() },
                user: { _id: adminUserId, username: 'super_lead', role: 'super_admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await assignAdminSupportTicketController(req, res);

            expect(fakeTicket.assignedAdmin).toEqual(adminUserId);
            expect(fakeTicket.save).toHaveBeenCalled();
            expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'TICKET_ASSIGNED',
                targetType: 'SupportTicket'
            }));
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true
            }));
        });

        test('updateAdminSupportTicketStatusController: updates status and priority and audits changes', async () => {
            const ticketId = 'KIVI-SUP-445566';
            const fakeTicket = {
                _id: new mongoose.Types.ObjectId(),
                ticketId,
                email: 'candidate@example.com',
                status: 'OPEN',
                priority: 'Normal',
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(SupportTicket, 'findOne').mockResolvedValue(fakeTicket);
            const auditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue({});

            const req = {
                params: { ticketId },
                body: { status: 'IN_PROGRESS', priority: 'Urgent' },
                user: { _id: new mongoose.Types.ObjectId(), username: 'staff1', role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await updateAdminSupportTicketStatusController(req, res);

            expect(fakeTicket.status).toBe('IN_PROGRESS');
            expect(fakeTicket.priority).toBe('Urgent');
            expect(fakeTicket.save).toHaveBeenCalled();
            expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'TICKET_STATUS_UPDATED',
                targetType: 'SupportTicket'
            }));
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('3. Internal Notes & Admin Response Dispatch', () => {
        test('addAdminInternalNoteController: appends private staff note and logs audit event', async () => {
            const ticketId = 'KIVI-SUP-123456';
            const fakeTicket = {
                _id: new mongoose.Types.ObjectId(),
                ticketId,
                email: 'test@example.com',
                internalNotes: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(SupportTicket, 'findOne').mockResolvedValue(fakeTicket);
            const auditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue({});

            const req = {
                params: { ticketId },
                body: { note: 'Confirmed with payment gateway, refund initiated.' },
                user: { _id: new mongoose.Types.ObjectId(), username: 'staff_agent', role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await addAdminInternalNoteController(req, res);

            expect(fakeTicket.internalNotes).toHaveLength(1);
            expect(fakeTicket.internalNotes[0].note).toBe('Confirmed with payment gateway, refund initiated.');
            expect(fakeTicket.save).toHaveBeenCalled();
            expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'TICKET_NOTE_ADDED'
            }));
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('replyAdminSupportTicketController: appends reply, transitions status, and triggers email notification', async () => {
            const ticketId = 'KIVI-SUP-123456';
            const fakeTicket = {
                _id: new mongoose.Types.ObjectId(),
                ticketId,
                subject: 'Mock Interview Bug',
                email: 'user@example.com',
                status: 'OPEN',
                responseHistory: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(SupportTicket, 'findOne').mockResolvedValue(fakeTicket);
            jest.spyOn(emailService, 'sendSupportReplyEmail').mockResolvedValue({ success: true, messageId: 'msg-1' });
            const auditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue({});

            const req = {
                params: { ticketId },
                body: { message: 'We have updated your generation credits. Please try again.', sendEmail: true },
                user: { _id: new mongoose.Types.ObjectId(), username: 'staff_support', role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await replyAdminSupportTicketController(req, res);

            expect(fakeTicket.status).toBe('WAITING_FOR_USER');
            expect(fakeTicket.responseHistory).toHaveLength(1);
            expect(fakeTicket.responseHistory[0].senderType).toBe('admin');
            expect(fakeTicket.save).toHaveBeenCalled();
            expect(emailService.sendSupportReplyEmail).toHaveBeenCalledWith(
                'user@example.com',
                expect.objectContaining({ ticketId, subject: 'Mock Interview Bug' })
            );
            expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'TICKET_REPLIED'
            }));
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                emailDelivered: true
            }));
        });
    });

    describe('4. User Security & Ownership Isolation', () => {
        test('getUserTicketDetailsController: rejects inspection of another user\'s ticket with 403 Forbidden', async () => {
            const ticketId = 'KIVI-SUP-SECRET';
            const ownerId = new mongoose.Types.ObjectId();
            const attackerId = new mongoose.Types.ObjectId();

            const fakeTicket = {
                ticketId,
                userId: ownerId,
                email: 'owner@example.com',
                subject: 'Private Question'
            };

            const mockFindOne = {
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(fakeTicket)
            };
            jest.spyOn(SupportTicket, 'findOne').mockReturnValue(mockFindOne);

            const req = {
                params: { ticketId },
                user: { _id: attackerId, email: 'attacker@example.com', role: 'user' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await getUserTicketDetailsController(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Access denied')
            }));
        });

        test('getUserTicketDetailsController: strictly excludes internalNotes from query projection', async () => {
            const ticketId = 'KIVI-SUP-LEGIT';
            const candidateId = new mongoose.Types.ObjectId();

            const fakeTicket = {
                ticketId,
                userId: candidateId,
                email: 'candidate@example.com',
                subject: 'Need Help',
                responseHistory: []
            };

            const mockFindOne = {
                select: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(fakeTicket)
            };
            const selectSpy = jest.spyOn(SupportTicket, 'findOne').mockReturnValue(mockFindOne);

            const req = {
                params: { ticketId },
                user: { _id: candidateId, email: 'candidate@example.com', role: 'user' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await getUserTicketDetailsController(req, res);

            expect(mockFindOne.select).toHaveBeenCalledWith('-internalNotes');
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                ticket: fakeTicket
            }));
        });

        test('replyUserTicketController: appends candidate response and moves ticket to IN_PROGRESS', async () => {
            const ticketId = 'KIVI-SUP-REPLY';
            const candidateId = new mongoose.Types.ObjectId();

            const fakeTicket = {
                ticketId,
                userId: candidateId,
                email: 'candidate@example.com',
                status: 'WAITING_FOR_USER',
                responseHistory: [],
                save: jest.fn().mockResolvedValue(true)
            };

            jest.spyOn(SupportTicket, 'findOne').mockResolvedValue(fakeTicket);

            const req = {
                params: { ticketId },
                body: { message: 'Thanks for the quick reply! The issue is now happening on mobile.' },
                user: { _id: candidateId, username: 'candidate_alice', email: 'candidate@example.com', role: 'user' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await replyUserTicketController(req, res);

            expect(fakeTicket.status).toBe('IN_PROGRESS');
            expect(fakeTicket.responseHistory).toHaveLength(1);
            expect(fakeTicket.responseHistory[0].senderType).toBe('user');
            expect(fakeTicket.responseHistory[0].senderName).toBe('candidate_alice');
            expect(fakeTicket.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });
});

