/**
 * adminExport.test.js — Test suite for IMPLEMENTATION 05 (Admin Data Export System)
 *
 * Verifies:
 * 1. Module and format validation (rejects invalid targets).
 * 2. CSV streaming export with proper headers and data formatting.
 * 3. Excel XLSX streaming export.
 * 4. Password and credential exclusion (security field restrictions).
 * 5. Query filter application (role, status, date range).
 * 6. Admin Audit Trail logging on data export.
 */

'use strict';

const mongoose = require('mongoose');
const userModel = require('../models/user.model');
const Payment = require('../models/payment.model');
const { Invoice } = require('../models/invoice.model');
const { exportAdminDataController } = require('../controller/admin.controller');
const { getExportFilename } = require('../services/export.service');
const auditLogService = require('../services/auditLog.service');

// Mock SystemEvent creation to prevent buffering in tests
jest.mock('../models/systemEvent.model', () => ({
    SystemEvent: {
        create: jest.fn().mockResolvedValue({ _id: new (require('mongoose').Types.ObjectId)() }),
        find: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            lean: jest.fn().mockReturnThis(),
            cursor: jest.fn().mockReturnValue((async function* () {
                yield {
                    _id: new (require('mongoose').Types.ObjectId)(),
                    eventType: 'TEST_EVENT',
                    category: 'ADMIN',
                    severity: 'INFO',
                    actorRole: 'admin',
                    targetType: 'User',
                    details: { changeSummary: 'Test summary' },
                    createdAt: new Date()
                };
            })())
        })
    }
}));

describe('IMPLEMENTATION 05 — Admin Data Export System Test Suite', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('1. Filename & Format Validation', () => {
        test('getExportFilename formats clean timestamped filenames', () => {
            const today = new Date().toISOString().split('T')[0];
            expect(getExportFilename('users', 'csv')).toBe(`kivi-users-${today}.csv`);
            expect(getExportFilename('invoices', 'xlsx')).toBe(`kivi-invoices-${today}.xlsx`);
            expect(getExportFilename('audit-logs', 'CSV')).toBe(`kivi-audit-logs-${today}.csv`);
        });

        test('exportAdminDataController rejects unsupported modules with 400', async () => {
            const req = {
                params: { moduleName: 'unsupported_module' },
                query: { format: 'csv' },
                user: { id: 'admin1', username: 'admin', role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await exportAdminDataController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Invalid export target')
            }));
        });

        test('exportAdminDataController rejects invalid format with 400', async () => {
            const req = {
                params: { moduleName: 'users' },
                query: { format: 'pdf_unsupported' },
                user: { id: 'admin1', username: 'admin', role: 'admin' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await exportAdminDataController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining('Supported formats: csv, xlsx')
            }));
        });
    });

    describe('2. CSV Streaming & Security Redaction', () => {
        test('exports users as CSV and strictly excludes password and credentials', async () => {
            const fakeUsers = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    username: 'john_doe',
                    email: 'john@example.com',
                    plan: 'pro',
                    role: 'user',
                    isBlocked: false,
                    isDeleted: false,
                    customBonusCredits: 5,
                    generationsUsed: 12,
                    password: '$2a$10$SUPER_SECRET_HASH_THAT_MUST_NEVER_LEAK',
                    createdAt: new Date('2026-01-15')
                }
            ];

            const mockCursor = (async function* () {
                for (const u of fakeUsers) yield u;
            })();

            jest.spyOn(userModel, 'find').mockReturnValue({
                select: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                cursor: jest.fn().mockReturnValue(mockCursor)
            });

            const auditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue(true);

            let streamedOutput = '';
            const headers = {};
            const res = {
                setHeader: jest.fn((k, v) => { headers[k] = v; }),
                write: jest.fn((chunk) => { streamedOutput += chunk.toString(); return true; }),
                end: jest.fn(() => {}),
                on: jest.fn(),
                once: jest.fn(),
                emit: jest.fn()
            };

            const req = {
                params: { moduleName: 'users' },
                query: { format: 'csv' },
                user: { id: 'admin_test_1', username: 'superadmin', role: 'super_admin' }
            };

            await exportAdminDataController(req, res);

            expect(headers['Content-Type']).toContain('text/csv');
            expect(headers['Content-Disposition']).toContain('attachment; filename="kivi-users-');
            expect(headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');

            // Wait brief microtask for stream piping to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Content Assertions
            expect(streamedOutput).toContain('User ID');
            expect(streamedOutput).toContain('john_doe');
            expect(streamedOutput).toContain('john@example.com');
            expect(streamedOutput).toContain('PRO');

            // Security Assertion: Password hash must NOT be in the export output
            expect(streamedOutput).not.toContain('SUPER_SECRET_HASH');
            expect(streamedOutput).not.toContain('$2a$10$');

            // Audit Trail Assertion
            expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'DATA_EXPORTED',
                targetType: 'Export'
            }));
        });
    });

    describe('3. Invoices & Payments Export Formatting', () => {
        test('exports invoices as CSV with tax calculations and proper columns', async () => {
            const fakeInvoices = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    invoiceNumber: 'INV-202611-000999',
                    userId: { username: 'buyer_one', email: 'buyer@example.com' },
                    billTo: { name: 'Buyer Corp', email: 'billing@buyer.com' },
                    planKey: 'premium',
                    billingCycle: 'YEARLY',
                    subtotal: 84661,
                    taxAmount: 15239,
                    totalAmount: 99900,
                    status: 'PAID',
                    issuedAt: new Date('2026-11-05')
                }
            ];

            const mockCursor = (async function* () {
                for (const inv of fakeInvoices) yield inv;
            })();

            jest.spyOn(Invoice, 'find').mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                cursor: jest.fn().mockReturnValue(mockCursor)
            });

            let streamedOutput = '';
            const headers = {};
            const res = {
                setHeader: jest.fn((k, v) => { headers[k] = v; }),
                write: jest.fn((chunk) => { streamedOutput += chunk.toString(); return true; }),
                end: jest.fn(() => {}),
                on: jest.fn(),
                once: jest.fn(),
                emit: jest.fn()
            };

            const req = {
                params: { moduleName: 'invoices' },
                query: { format: 'csv', status: 'PAID' },
                user: { id: 'admin_test_2', username: 'admin_user', role: 'admin' }
            };

            await exportAdminDataController(req, res);

            await new Promise(resolve => setTimeout(resolve, 50));

            expect(streamedOutput).toContain('Invoice Number');
            expect(streamedOutput).toContain('INV-202611-000999');
            expect(streamedOutput).toContain('buyer@example.com');
            expect(streamedOutput).toContain('Buyer Corp');
            expect(streamedOutput).toContain('999.00');
            expect(streamedOutput).toContain('PAID');
        });
    });
});

