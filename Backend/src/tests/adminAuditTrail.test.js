'use strict';

const mongoose = require('mongoose');
const { SystemEvent } = require('../models/systemEvent.model');
const { recordAdminAudit, sanitizeAuditData } = require('../services/auditLog.service');

describe('Admin Audit Trail System', () => {

    describe('Data Sanitization', () => {
        it('should redact passwords, tokens, API keys, and secrets', () => {
            const raw = {
                username: 'admin_test',
                password: 'superSecretPassword123!',
                apiKey: 'gsk_12345abcdef',
                token: 'eyJhbGciOi...',
                jwt: 'token_val',
                otp: '123456',
                details: {
                    userSecret: 'confidential',
                    safeField: 'active'
                }
            };

            const sanitized = sanitizeAuditData(raw);

            expect(sanitized.username).toBe('admin_test');
            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.apiKey).toBe('[REDACTED]');
            expect(sanitized.token).toBe('[REDACTED]');
            expect(sanitized.jwt).toBe('[REDACTED]');
            expect(sanitized.otp).toBe('[REDACTED]');
            expect(sanitized.details.userSecret).toBe('[REDACTED]');
            expect(sanitized.details.safeField).toBe('active');
        });

        it('should truncate massive resume HTML strings in audit metadata', () => {
            const hugeHtml = '<div>' + 'A'.repeat(500) + '</div>';
            const raw = {
                generatedResumeHtml: hugeHtml,
                title: 'Resume Test'
            };

            const sanitized = sanitizeAuditData(raw);

            expect(sanitized.title).toBe('Resume Test');
            expect(sanitized.generatedResumeHtml).toContain('[Text truncated:');
            expect(sanitized.generatedResumeHtml.length).toBeLessThan(100);
        });
    });

    describe('SystemEvent Schema & Audit Persistence', () => {
        it('should create and format an admin audit event document correctly', () => {
            const actorId = new mongoose.Types.ObjectId();
            const targetId = new mongoose.Types.ObjectId();

            const doc = new SystemEvent({
                eventType: 'USER_SUSPENDED',
                category: 'ADMIN',
                severity: 'WARN',
                actorId,
                actorRole: 'super_admin',
                targetId,
                targetType: 'User',
                ipAddress: '127.0.0.1',
                userAgent: 'Mozilla/5.0 Test',
                details: {
                    action: 'USER_SUSPENDED',
                    targetIdentifier: 'testuser (test@example.com)',
                    before: { isBlocked: false },
                    after: { isBlocked: true },
                    changeSummary: 'Suspended user testuser',
                    reason: 'Terms violation'
                }
            });

            const validationError = doc.validateSync();
            expect(validationError).toBeUndefined();
            expect(doc.eventType).toBe('USER_SUSPENDED');
            expect(doc.category).toBe('ADMIN');
            expect(doc.severity).toBe('WARN');
            expect(doc.actorRole).toBe('super_admin');
            expect(doc.details.before.isBlocked).toBe(false);
            expect(doc.details.after.isBlocked).toBe(true);
            expect(doc.details.reason).toBe('Terms violation');
        });

        it('should safely record audit log without throwing even if DB write rejects', async () => {
            const spy = jest.spyOn(SystemEvent, 'create').mockRejectedValueOnce(new Error('Simulated DB failure'));

            const req = {
                user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
                headers: { 'user-agent': 'Jest' },
                socket: { remoteAddress: '127.0.0.1' }
            };

            // Should not throw
            await expect(recordAdminAudit({
                req,
                action: 'TEST_ACTION',
                changeSummary: 'Testing non-blocking failure'
            })).resolves.toBeUndefined();

            spy.mockRestore();
        });
    });

    describe('Audit Log Controller Querying Logic', () => {
        it('should validate query filters and format response envelope', async () => {
            const mockEvents = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    eventType: 'USER_ROLE_CHANGED',
                    category: 'ADMIN',
                    severity: 'WARN',
                    actorId: { username: 'superadmin', email: 'admin@kivi.ai', role: 'super_admin' },
                    targetId: { username: 'candidate1', email: 'user@kivi.ai', role: 'admin' },
                    details: {
                        action: 'USER_ROLE_CHANGED',
                        before: { role: 'user' },
                        after: { role: 'admin' },
                        changeSummary: 'Changed role from "user" to "admin"'
                    },
                    createdAt: new Date()
                }
            ];

            const mockFind = jest.fn().mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(mockEvents)
            });

            const findSpy = jest.spyOn(SystemEvent, 'find').mockImplementation(mockFind);
            const countSpy = jest.spyOn(SystemEvent, 'countDocuments').mockResolvedValue(1);

            const { getAdminAuditLogsController } = require('../controller/admin.controller');

            const req = {
                query: {
                    page: '1',
                    limit: '25',
                    category: 'ADMIN',
                    action: 'USER_ROLE_CHANGED'
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await getAdminAuditLogsController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                source: 'system',
                data: mockEvents,
                pagination: expect.objectContaining({
                    total: 1,
                    page: 1,
                    limit: 25
                })
            }));

            findSpy.mockRestore();
            countSpy.mockRestore();
        });
    });
});

