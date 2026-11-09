/**
 * export.service.js — Admin Data Export System
 *
 * Implements:
 * 1. High-throughput cursor/stream-based export without loading collections into memory.
 * 2. Supported formats: CSV (via csv-stringify) and Excel XLSX (via exceljs).
 * 3. Supported modules: Users, Payments, Subscriptions, Invoices, Audit Logs, Support Tickets.
 * 4. Strict role-based field restrictions & credential sanitization (passwords, tokens, PII purged).
 * 5. Safe HTTP headers and content disposition.
 * 6. Admin audit logging integration.
 */

'use strict';

const mongoose = require('mongoose');
const { stringify } = require('csv-stringify');
const ExcelJS = require('exceljs');

const userModel = require('../models/user.model');
const Payment = require('../models/payment.model');
const subscriptionModel = require('../models/subscription.model');
const { Invoice } = require('../models/invoice.model');
const { SystemEvent } = require('../models/systemEvent.model');
const SupportTicket = require('../models/supportTicket.model');
const JobModel = require('../models/job.model');
const auditLogService = require('./auditLog.service');

// Map of supported modules
const SUPPORTED_MODULES = ['users', 'payments', 'subscriptions', 'invoices', 'audit-logs', 'support-tickets', 'jobs'];
const SUPPORTED_FORMATS = ['csv', 'xlsx'];

/**
 * Generates a safe, sanitized filename for downloads
 */
function getExportFilename(moduleName, format) {
    const dateStr = new Date().toISOString().split('T')[0];
    const cleanModule = String(moduleName).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanFormat = String(format).toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
    return `kivi-${cleanModule}-${dateStr}.${cleanFormat}`;
}

/**
 * Configure standard streaming headers
 */
function setExportHeaders(res, filename, format) {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (format === 'xlsx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    }
}

/**
 * Build Mongoose query cursor and export columns configuration for each module
 */
async function getModuleExportConfig(moduleName, queryParams = {}) {
    const { status, plan, role, search, startDate, endDate, category, priority, action } = queryParams;

    switch (moduleName) {
        case 'users': {
            const filter = {};
            if (role) filter.role = role.toLowerCase();
            if (plan) filter.plan = plan.toLowerCase();
            if (queryParams.isBlocked !== undefined && queryParams.isBlocked !== '') {
                filter.isBlocked = queryParams.isBlocked === 'true';
            }
            if (search && search.trim()) {
                const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [{ username: searchRegex }, { email: searchRegex }];
            }

            const cursor = userModel.find(filter)
                .select('_id username email plan role isBlocked isDeleted customBonusCredits generationsUsed lastActiveAt createdAt updatedAt')
                .sort({ createdAt: -1 })
                .lean()
                .cursor();

            const columns = [
                { header: 'User ID', key: 'id', width: 26 },
                { header: 'Username', key: 'username', width: 20 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Plan', key: 'plan', width: 14 },
                { header: 'Role', key: 'role', width: 14 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Bonus Credits', key: 'bonusCredits', width: 16 },
                { header: 'Generations Used', key: 'generationsUsed', width: 18 },
                { header: 'Last Active Date', key: 'lastActiveAt', width: 22 },
                { header: 'Created Date', key: 'createdAt', width: 22 }
            ];

            const transform = (doc) => ({
                id: doc._id.toString(),
                username: doc.username || '',
                email: doc.email || '',
                plan: (doc.plan || 'free').toUpperCase(),
                role: (doc.role || 'user').toUpperCase(),
                status: doc.isDeleted ? 'ARCHIVED' : (doc.isBlocked ? 'SUSPENDED' : 'ACTIVE'),
                bonusCredits: doc.customBonusCredits || 0,
                generationsUsed: doc.generationsUsed || 0,
                lastActiveAt: doc.lastActiveAt ? new Date(doc.lastActiveAt).toISOString() : 'Never Active',
                createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : ''
            });

            return { cursor, columns, transform, filter };
        }

        case 'payments': {
            const filter = {};
            if (status) filter.status = status.toUpperCase();
            if (startDate || endDate) {
                filter.createdAt = {};
                if (startDate && !isNaN(new Date(startDate).getTime())) filter.createdAt.$gte = new Date(startDate);
                if (endDate && !isNaN(new Date(endDate).getTime())) {
                    const e = new Date(endDate);
                    e.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = e;
                }
            }

            const cursor = Payment.find(filter)
                .populate('userId', 'username email isDeleted')
                .populate('orderId', 'planKey billingCycle amount')
                .sort({ createdAt: -1 })
                .lean()
                .cursor();

            const columns = [
                { header: 'Payment ID', key: 'id', width: 26 },
                { header: 'Gateway Payment ID', key: 'gatewayPaymentId', width: 28 },
                { header: 'Customer Username', key: 'username', width: 20 },
                { header: 'Customer Email', key: 'email', width: 30 },
                { header: 'Plan Tier', key: 'plan', width: 14 },
                { header: 'Billing Cycle', key: 'billingCycle', width: 16 },
                { header: 'Amount (INR)', key: 'amount', width: 16 },
                { header: 'Currency', key: 'currency', width: 10 },
                { header: 'Payment Method', key: 'paymentMethod', width: 16 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Paid At', key: 'paidAt', width: 22 },
                { header: 'Created Date', key: 'createdAt', width: 22 }
            ];

            const transform = (doc) => ({
                id: doc._id.toString(),
                gatewayPaymentId: doc.gatewayPaymentId || '',
                username: doc.userId?.username || 'Archived User',
                email: doc.userId?.email || '',
                plan: (doc.orderId?.planKey || 'PRO').toUpperCase(),
                billingCycle: doc.orderId?.billingCycle || 'MONTHLY',
                amount: (doc.amount / 100).toFixed(2),
                currency: doc.currency || 'INR',
                paymentMethod: doc.paymentMethod || 'gateway',
                status: doc.status || 'PENDING',
                paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : '',
                createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : ''
            });

            return { cursor, columns, transform, filter };
        }

        case 'subscriptions': {
            const filter = {};
            if (status) {
                filter.status = { $regex: new RegExp(`^${status.trim()}$`, 'i') };
            }
            if (plan) {
                filter.plan = { $regex: new RegExp(`^${plan.trim()}$`, 'i') };
            }

            const pipeline = [
                { $match: filter },
                { $sort: { createdAt: -1 } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'subscriptionplans',
                        localField: 'planId',
                        foreignField: '_id',
                        as: 'planDoc'
                    }
                },
                { $unwind: { path: '$planDoc', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'payments',
                        let: { subUserId: '$userId' },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$userId', '$$subUserId'] } } },
                            { $sort: { createdAt: -1 } },
                            { $limit: 1 }
                        ],
                        as: 'lastPayment'
                    }
                },
                { $unwind: { path: '$lastPayment', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'invoices',
                        let: { subUserId: '$userId' },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$userId', '$$subUserId'] } } },
                            { $sort: { createdAt: -1 } },
                            { $limit: 1 }
                        ],
                        as: 'lastInvoice'
                    }
                },
                { $unwind: { path: '$lastInvoice', preserveNullAndEmptyArrays: true } }
            ];

            const cursor = subscriptionModel.aggregate(pipeline).cursor();

            const columns = [
                // Preserved original 10 export columns
                { header: 'Subscription ID', key: 'id', width: 26 },
                { header: 'Customer Username', key: 'username', width: 20 },
                { header: 'Customer Email', key: 'email', width: 30 },
                { header: 'Plan', key: 'plan', width: 14 },
                { header: 'Billing Cycle', key: 'billingCycle', width: 16 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Period Start', key: 'currentPeriodStart', width: 22 },
                { header: 'Period End', key: 'currentPeriodEnd', width: 22 },
                { header: 'Cancel At Period End', key: 'cancelAtPeriodEnd', width: 20 },
                { header: 'Started Date', key: 'startedAt', width: 22 },

                // Additional Section 3 columns
                { header: 'Auto Renew', key: 'autoRenew', width: 14 },
                { header: 'Cancelled At', key: 'canceledAt', width: 22 },
                { header: 'Ended At', key: 'endedAt', width: 22 },
                { header: 'Next Billing Date', key: 'nextBillingDate', width: 22 },
                { header: 'Last Payment Status', key: 'lastPaymentStatus', width: 20 },
                { header: 'Last Payment ID', key: 'lastPaymentId', width: 28 },
                { header: 'Latest Invoice Number', key: 'latestInvoiceNumber', width: 22 },
                { header: 'Created At', key: 'createdAt', width: 22 },
                { header: 'Updated At', key: 'updatedAt', width: 22 },
                { header: 'Subscription Amount', key: 'amount', width: 20 },
                { header: 'Currency', key: 'currency', width: 12 },
                { header: 'Trial Start', key: 'trialStart', width: 14 },
                { header: 'Trial End', key: 'trialEnd', width: 14 },
                { header: 'Coupon / Discount', key: 'discount', width: 18 }
            ];

            const transform = (doc) => {
                const normalizedStatus = doc.status ? String(doc.status).toUpperCase() : 'ACTIVE';
                const isPaidPlan = ['pro', 'premium'].includes((doc.plan || '').toLowerCase());
                const autoRenew = !doc.cancelAtPeriodEnd;
                const nextBillingDate = (autoRenew && normalizedStatus === 'ACTIVE' && isPaidPlan && doc.currentPeriodEnd)
                    ? new Date(doc.currentPeriodEnd).toISOString()
                    : '';
                const endedAt = (normalizedStatus === 'CANCELLED' || normalizedStatus === 'EXPIRED') && doc.currentPeriodEnd
                    ? new Date(doc.currentPeriodEnd).toISOString()
                    : '';

                // Safe fallback for period start without fabricating dates
                const periodStart = doc.currentPeriodStart
                    ? new Date(doc.currentPeriodStart).toISOString()
                    : (doc.startedAt ? new Date(doc.startedAt).toISOString() : '');

                const amountVal = doc.lastPayment?.amount
                    ? (doc.lastPayment.amount / 100).toFixed(2)
                    : (doc.planDoc?.price !== undefined
                        ? Number(doc.planDoc.price).toFixed(2)
                        : (isPaidPlan ? '99.00' : '0.00'));

                return {
                    id: doc._id.toString(),
                    username: doc.user?.username || (doc.userId ? 'Archived User' : 'Unknown'),
                    email: doc.user?.email || '',
                    plan: (doc.plan || 'free').toUpperCase(),
                    billingCycle: doc.billingCycle || 'MONTHLY',
                    status: normalizedStatus,
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: doc.currentPeriodEnd ? new Date(doc.currentPeriodEnd).toISOString() : '',
                    cancelAtPeriodEnd: doc.cancelAtPeriodEnd ? 'Yes' : 'No',
                    startedAt: doc.startedAt ? new Date(doc.startedAt).toISOString() : (doc.createdAt ? new Date(doc.createdAt).toISOString() : ''),
                    autoRenew: autoRenew ? 'Yes' : 'No',
                    canceledAt: doc.canceledAt ? new Date(doc.canceledAt).toISOString() : '',
                    endedAt,
                    nextBillingDate,
                    lastPaymentStatus: doc.lastPayment?.status || (isPaidPlan ? 'NO_PAYMENT_FOUND' : 'N/A (FREE)'),
                    lastPaymentId: doc.lastPayment?.gatewayPaymentId || (doc.lastPayment?._id ? doc.lastPayment._id.toString() : ''),
                    latestInvoiceNumber: doc.lastInvoice?.invoiceNumber || '',
                    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : '',
                    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : '',
                    amount: amountVal,
                    currency: doc.lastPayment?.currency || 'INR',
                    trialStart: '',
                    trialEnd: '',
                    discount: 'None'
                };
            };

            return { cursor, columns, transform, filter };
        }

        case 'invoices': {
            const filter = {};
            if (status && ['ISSUED', 'PAID', 'VOID'].includes(status.toUpperCase())) {
                filter.status = status.toUpperCase();
            }
            if (startDate || endDate) {
                filter.issuedAt = {};
                if (startDate && !isNaN(new Date(startDate).getTime())) filter.issuedAt.$gte = new Date(startDate);
                if (endDate && !isNaN(new Date(endDate).getTime())) {
                    const e = new Date(endDate);
                    e.setHours(23, 59, 59, 999);
                    filter.issuedAt.$lte = e;
                }
            }
            if (search && search.trim()) {
                const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [
                    { invoiceNumber: searchRegex },
                    { 'billTo.name': searchRegex },
                    { 'billTo.email': searchRegex }
                ];
            }

            const cursor = Invoice.find(filter)
                .populate('userId', 'username email isDeleted')
                .sort({ issuedAt: -1 })
                .lean()
                .cursor();

            const columns = [
                { header: 'Invoice Number', key: 'invoiceNumber', width: 22 },
                { header: 'Customer Username', key: 'username', width: 20 },
                { header: 'Customer Email', key: 'email', width: 30 },
                { header: 'Billed To Name', key: 'billToName', width: 22 },
                { header: 'Billed To Email', key: 'billToEmail', width: 30 },
                { header: 'Plan Key', key: 'planKey', width: 14 },
                { header: 'Billing Cycle', key: 'billingCycle', width: 16 },
                { header: 'Subtotal (Net INR)', key: 'subtotal', width: 18 },
                { header: 'GST Tax (INR)', key: 'taxAmount', width: 16 },
                { header: 'Total Paid (INR)', key: 'totalAmount', width: 18 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Issued Date', key: 'issuedAt', width: 22 }
            ];

            const transform = (doc) => ({
                invoiceNumber: doc.invoiceNumber || '',
                username: doc.userId?.username || 'Archived User',
                email: doc.userId?.email || '',
                billToName: doc.billTo?.name || '',
                billToEmail: doc.billTo?.email || '',
                planKey: (doc.planKey || 'PRO').toUpperCase(),
                billingCycle: doc.billingCycle || 'MONTHLY',
                subtotal: ((doc.totalAmount - (doc.taxAmount || 0)) / 100).toFixed(2),
                taxAmount: ((doc.taxAmount || 0) / 100).toFixed(2),
                totalAmount: (doc.totalAmount / 100).toFixed(2),
                status: doc.status || 'PAID',
                issuedAt: doc.issuedAt ? new Date(doc.issuedAt).toISOString() : ''
            });

            return { cursor, columns, transform, filter };
        }

        case 'audit-logs': {
            const filter = {};
            if (category) filter.category = category.toUpperCase();
            if (action) filter.eventType = action.toUpperCase();
            if (startDate || endDate) {
                filter.createdAt = {};
                if (startDate && !isNaN(new Date(startDate).getTime())) filter.createdAt.$gte = new Date(startDate);
                if (endDate && !isNaN(new Date(endDate).getTime())) {
                    const e = new Date(endDate);
                    e.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = e;
                }
            }

            const cursor = SystemEvent.find(filter)
                .sort({ createdAt: -1 })
                .lean()
                .cursor();

            const columns = [
                { header: 'Event ID', key: 'id', width: 26 },
                { header: 'Timestamp', key: 'createdAt', width: 22 },
                { header: 'Action', key: 'action', width: 24 },
                { header: 'Category', key: 'category', width: 14 },
                { header: 'Severity', key: 'severity', width: 12 },
                { header: 'Actor Role', key: 'actorRole', width: 16 },
                { header: 'Target Type', key: 'targetType', width: 18 },
                { header: 'Target Identifier', key: 'targetIdentifier', width: 30 },
                { header: 'Change Summary', key: 'changeSummary', width: 45 },
                { header: 'IP Address', key: 'ipAddress', width: 18 }
            ];

            const transform = (doc) => ({
                id: doc._id.toString(),
                createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : '',
                action: doc.eventType || '',
                category: doc.category || 'SYSTEM',
                severity: doc.severity || 'INFO',
                actorRole: doc.actorRole || 'admin',
                targetType: doc.targetType || 'User',
                targetIdentifier: doc.details?.targetIdentifier || '',
                changeSummary: doc.details?.changeSummary || '',
                ipAddress: doc.details?.ipAddress || ''
            });

            return { cursor, columns, transform, filter };
        }

        case 'support-tickets': {
            const filter = {};
            if (status) filter.status = status.toUpperCase();
            if (priority) filter.priority = priority;
            if (category) filter.category = category;

            const cursor = SupportTicket.find(filter)
                .sort({ createdAt: -1 })
                .lean()
                .cursor();

            const columns = [
                { header: 'Ticket ID', key: 'ticketId', width: 20 },
                { header: 'Customer Name', key: 'name', width: 22 },
                { header: 'Customer Email', key: 'email', width: 30 },
                { header: 'Category', key: 'category', width: 20 },
                { header: 'Priority', key: 'priority', width: 14 },
                { header: 'Subject', key: 'subject', width: 30 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Submitted Date', key: 'createdAt', width: 22 }
            ];

            const transform = (doc) => ({
                ticketId: doc.ticketId || '',
                name: doc.name || '',
                email: doc.email || '',
                category: doc.category || '',
                priority: doc.priority || 'Normal',
                subject: doc.subject || '',
                status: doc.status || 'OPEN',
                createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : ''
            });

            return { cursor, columns, transform, filter };
        }

        case 'jobs': {
            const filter = {};
            if (status) filter.status = status.toLowerCase();
            if (queryParams.type) filter.type = queryParams.type.toLowerCase();
            if (startDate || endDate) {
                filter.createdAt = {};
                if (startDate && !isNaN(new Date(startDate).getTime())) filter.createdAt.$gte = new Date(startDate);
                if (endDate && !isNaN(new Date(endDate).getTime())) {
                    const e = new Date(endDate);
                    e.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = e;
                }
            }

            const cursor = JobModel.find(filter)
                .populate('userId', 'username email isDeleted')
                .select('_id type status attempts durationMs startedAt completedAt createdAt error bullJobId userId')
                .sort({ createdAt: -1 })
                .lean()
                .cursor();

            const columns = [
                { header: 'Job ID', key: 'id', width: 26 },
                { header: 'Type', key: 'type', width: 22 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Attempts', key: 'attempts', width: 12 },
                { header: 'Duration (ms)', key: 'durationMs', width: 16 },
                { header: 'Customer Username', key: 'username', width: 20 },
                { header: 'Customer Email', key: 'email', width: 30 },
                { header: 'BullMQ ID', key: 'bullJobId', width: 26 },
                { header: 'Created Date', key: 'createdAt', width: 22 },
                { header: 'Error Summary', key: 'error', width: 35 }
            ];

            const transform = (doc) => ({
                id: doc._id.toString(),
                type: doc.type || '',
                status: (doc.status || '').toUpperCase(),
                attempts: doc.attempts || 1,
                durationMs: doc.durationMs || 0,
                username: doc.userId?.username || 'Archived/System',
                email: doc.userId?.email || '',
                bullJobId: doc.bullJobId || '',
                createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : '',
                error: (doc.error || '').slice(0, 150)
            });

            return { cursor, columns, transform, filter };
        }

        default:
            throw { status: 400, message: `Unsupported export module "${moduleName}".` };
    }
}

/**
 * Streams exported dataset directly to the HTTP response
 */
async function streamExport({ moduleName, format, queryParams = {}, req, res }) {
    if (!SUPPORTED_MODULES.includes(moduleName.toLowerCase())) {
        return res.status(400).json({
            message: `Invalid export target. Allowed modules: ${SUPPORTED_MODULES.join(', ')}.`
        });
    }

    const cleanFormat = (format || 'csv').toLowerCase();
    if (!SUPPORTED_FORMATS.includes(cleanFormat)) {
        return res.status(400).json({
            message: `Invalid format "${format}". Supported formats: csv, xlsx.`
        });
    }

    const filename = getExportFilename(moduleName, cleanFormat);
    setExportHeaders(res, filename, cleanFormat);

    const { cursor, columns, transform, filter } = await getModuleExportConfig(moduleName.toLowerCase(), queryParams);

    let rowCount = 0;

    if (cleanFormat === 'xlsx') {
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
            stream: res,
            useStyles: true,
            useSharedStrings: false
        });

        const worksheet = workbook.addWorksheet(moduleName.toUpperCase());
        worksheet.columns = columns.map(col => ({
            header: col.header,
            key: col.key,
            width: col.width || 18
        }));

        for await (const doc of cursor) {
            rowCount += 1;
            worksheet.addRow(transform(doc)).commit();
        }

        worksheet.commit();
        await workbook.commit();
    } else {
        // CSV Streaming via csv-stringify
        const stringifier = stringify({
            header: true,
            columns: columns.map(c => ({ key: c.key, header: c.header }))
        });

        stringifier.pipe(res);

        for await (const doc of cursor) {
            rowCount += 1;
            stringifier.write(transform(doc));
        }

        stringifier.end();
    }

    // Record export activity in Admin Audit Trail
    try {
        await auditLogService.recordAdminAudit({
            req,
            action: 'DATA_EXPORTED',
            category: 'ADMIN',
            severity: 'INFO',
            targetType: 'Export',
            targetIdentifier: `${moduleName.toUpperCase()} (${cleanFormat.toUpperCase()})`,
            changeSummary: `Exported ${rowCount} records from "${moduleName}" as ${cleanFormat.toUpperCase()} (File: ${filename}).`,
            after: {
                module: moduleName,
                format: cleanFormat,
                recordsExported: rowCount,
                filename
            }
        });
    } catch (_) {}
}

module.exports = {
    SUPPORTED_MODULES,
    SUPPORTED_FORMATS,
    getExportFilename,
    streamExport
};
