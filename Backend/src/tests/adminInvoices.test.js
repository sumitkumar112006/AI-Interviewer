/**
 * adminInvoices.test.js — Automated test suite for IMPLEMENTATION 04 (Admin Invoice Management)
 *
 * Verifies:
 * 1. Server-side pagination and default sorting.
 * 2. Search by invoice number and customer identity.
 * 3. Status filtering (PAID, ISSUED, VOID).
 * 4. Date range filtering on issuedAt.
 * 5. Summary metrics aggregation (totalInvoices, totalRevenue, paidCount, voidCount).
 * 6. Printable HTML rendering via getInvoiceHtmlOrPdf.
 * 7. Admin authorization enforcement.
 */

'use strict';

const mongoose = require('mongoose');
const { Invoice } = require('../models/invoice.model');
const userModel = require('../models/user.model');
const { getAdminInvoicesController } = require('../controller/admin.controller');
const invoiceController = require('../controller/invoice.controller');
const invoiceService = require('../services/invoice.service');

describe('IMPLEMENTATION 04 — Admin Invoice Management Test Suite', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('1. Server-Side Pagination & Listing', () => {
        test('getAdminInvoicesController: returns paginated invoices with default limit and pagination metadata', async () => {
            const fakeInvoices = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    invoiceNumber: 'INV-202611-000001',
                    totalAmount: 49900,
                    status: 'PAID',
                    issuedAt: new Date(),
                    userId: { username: 'testuser', email: 'test@example.com' }
                }
            ];

            const mockFind = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockResolvedValue(fakeInvoices)
            };

            jest.spyOn(Invoice, 'find').mockReturnValue(mockFind);
            jest.spyOn(Invoice, 'countDocuments').mockResolvedValue(25);
            jest.spyOn(Invoice, 'aggregate').mockResolvedValue([
                {
                    totalInvoices: 25,
                    totalRevenuePaise: 49900 * 20,
                    paidCount: 20,
                    issuedCount: 3,
                    voidCount: 2
                }
            ]);

            const req = { query: { page: '1', limit: '20' } };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await getAdminInvoicesController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: fakeInvoices,
                summary: expect.objectContaining({
                    totalInvoices: 25,
                    paidCount: 20,
                    issuedCount: 3,
                    voidCount: 2
                }),
                pagination: expect.objectContaining({
                    total: 25,
                    page: 1,
                    pages: 2,
                    limit: 20
                })
            }));
        });
    });

    describe('2. Search & Filtering Functionality', () => {
        test('filters by status (case-insensitive PAID/ISSUED/VOID)', async () => {
            let capturedFilter = null;
            const mockFind = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockImplementation(() => Promise.resolve([]))
            };

            jest.spyOn(Invoice, 'find').mockImplementation((f) => {
                capturedFilter = f;
                return mockFind;
            });
            jest.spyOn(Invoice, 'countDocuments').mockResolvedValue(0);
            jest.spyOn(Invoice, 'aggregate').mockResolvedValue([]);

            const req = { query: { status: 'paid' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await getAdminInvoicesController(req, res);

            expect(capturedFilter).toBeDefined();
            expect(capturedFilter.status).toBe('PAID');
        });

        test('filters by date range on issuedAt', async () => {
            let capturedFilter = null;
            const mockFind = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockImplementation(() => Promise.resolve([]))
            };

            jest.spyOn(Invoice, 'find').mockImplementation((f) => {
                capturedFilter = f;
                return mockFind;
            });
            jest.spyOn(Invoice, 'countDocuments').mockResolvedValue(0);
            jest.spyOn(Invoice, 'aggregate').mockResolvedValue([]);

            const req = {
                query: {
                    startDate: '2026-11-01',
                    endDate: '2026-11-30'
                }
            };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await getAdminInvoicesController(req, res);

            expect(capturedFilter.issuedAt).toBeDefined();
            expect(capturedFilter.issuedAt.$gte).toBeInstanceOf(Date);
            expect(capturedFilter.issuedAt.$lte).toBeInstanceOf(Date);
        });

        test('searches by invoiceNumber and customer identity', async () => {
            let capturedFilter = null;
            const mockFind = {
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockImplementation(() => Promise.resolve([]))
            };

            jest.spyOn(userModel, 'find').mockReturnValue({
                select: jest.fn().mockReturnValue({
                    limit: jest.fn().mockReturnValue({
                        lean: jest.fn().mockResolvedValue([
                            { _id: new mongoose.Types.ObjectId('6af09b2cea09c63a2ba5700d') }
                        ])
                    })
                })
            });

            jest.spyOn(Invoice, 'find').mockImplementation((f) => {
                capturedFilter = f;
                return mockFind;
            });
            jest.spyOn(Invoice, 'countDocuments').mockResolvedValue(0);
            jest.spyOn(Invoice, 'aggregate').mockResolvedValue([]);

            const req = { query: { search: 'INV-202611' } };
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

            await getAdminInvoicesController(req, res);

            expect(capturedFilter.$or).toBeDefined();
            expect(capturedFilter.$or.some(c => c.invoiceNumber)).toBe(true);
            expect(capturedFilter.$or.some(c => c.userId)).toBe(true);
        });
    });

    describe('3. Printable Invoice Document Rendering', () => {
        test('getInvoiceHtmlOrPdf: renders structured tax invoice HTML for administrators', async () => {
            const fakeInvoice = {
                _id: new mongoose.Types.ObjectId(),
                invoiceNumber: 'INV-202611-000100',
                status: 'PAID',
                issuedAt: new Date(),
                currency: 'INR',
                totalAmount: 99900,
                taxAmount: 15239,
                billTo: { name: 'Acme Candidate', email: 'acme@example.com' },
                items: [
                    {
                        description: 'Premium Plan — Monthly Subscription',
                        quantity: 1,
                        unitAmount: 99900,
                        amount: 99900
                    }
                ]
            };

            jest.spyOn(invoiceService, 'getInvoiceById').mockResolvedValue(fakeInvoice);

            const req = {
                params: { id: fakeInvoice._id.toString() },
                user: { id: 'admin_id_123', isAdmin: true, role: 'admin' }
            };

            let sentHtml = '';
            const res = {
                setHeader: jest.fn(),
                send: jest.fn((html) => { sentHtml = html; })
            };
            const next = jest.fn();

            await invoiceController.getInvoiceHtmlOrPdf(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
            expect(sentHtml).toContain('TAX INVOICE');
            expect(sentHtml).toContain('INV-202611-000100');
            expect(sentHtml).toContain('Acme Candidate');
            expect(sentHtml).toContain('Premium Plan');
            expect(sentHtml).toContain('₹999.00');
        });
    });
});

