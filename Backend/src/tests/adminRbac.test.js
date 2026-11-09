/**
 * adminRbac.test.js — Automated test suite for IMPLEMENTATION 08 (Granular Admin RBAC)
 *
 * Verifies:
 * 1. Permission registry mapping for Super Admin, General Admin, and specialized functional roles.
 * 2. Granular permission middleware (`requirePermission`) enforcement:
 *    - Allows permitted roles.
 *    - Rejects unauthorized roles with 403 Forbidden and audit trail logging.
 * 3. Privilege Escalation Protection:
 *    - Ordinary admins cannot promote anyone to super_admin.
 *    - Ordinary admins cannot modify super_admin accounts.
 * 4. Backward Compatibility:
 *    - Existing 'admin' role seamlessly inherits standard operational permissions without breaking.
 */

'use strict';

const mongoose = require('mongoose');
const {
    PERMISSIONS,
    ALL_PERMISSIONS,
    ROLE_PERMISSIONS,
    getUserPermissions,
    hasPermission,
    canManageTargetRole
} = require('../config/rbac.config');
const { requirePermission } = require('../middleware/rbac.middleware');
const auditLogService = require('../services/auditLog.service');

describe('IMPLEMENTATION 08 — Granular Admin RBAC Test Suite', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('1. Role-to-Permission Registry & Mapping', () => {
        test('super_admin holds all registered platform permissions', () => {
            const superUser = { role: 'super_admin' };
            const perms = getUserPermissions(superUser);
            expect(perms.size).toBe(ALL_PERMISSIONS.length);
            expect(hasPermission(superUser, PERMISSIONS.ADMINS_MANAGE)).toBe(true);
            expect(hasPermission(superUser, PERMISSIONS.USERS_DELETE)).toBe(true);
            expect(hasPermission(superUser, PERMISSIONS.BILLING_REFUND)).toBe(true);
        });

        test('legacy admin holds operational permissions but NOT admins.manage or users.delete', () => {
            const legacyAdmin = { role: 'admin' };
            expect(hasPermission(legacyAdmin, PERMISSIONS.USERS_READ)).toBe(true);
            expect(hasPermission(legacyAdmin, PERMISSIONS.BILLING_READ)).toBe(true);
            expect(hasPermission(legacyAdmin, PERMISSIONS.SUPPORT_MANAGE)).toBe(true);
            expect(hasPermission(legacyAdmin, PERMISSIONS.JOBS_RETRY)).toBe(true);
            expect(hasPermission(legacyAdmin, PERMISSIONS.ADMINS_MANAGE)).toBe(false);
            expect(hasPermission(legacyAdmin, PERMISSIONS.USERS_DELETE)).toBe(false);
        });

        test('billing_admin has billing & invoice permissions, but lacks user suspension or job retry', () => {
            const billingAdmin = { role: 'billing_admin' };
            expect(hasPermission(billingAdmin, PERMISSIONS.BILLING_READ)).toBe(true);
            expect(hasPermission(billingAdmin, PERMISSIONS.BILLING_REFUND)).toBe(true);
            expect(hasPermission(billingAdmin, PERMISSIONS.INVOICES_READ)).toBe(true);
            expect(hasPermission(billingAdmin, PERMISSIONS.USERS_SUSPEND)).toBe(false);
            expect(hasPermission(billingAdmin, PERMISSIONS.JOBS_RETRY)).toBe(false);
        });

        test('support_admin has support permissions, but lacks billing or settings permissions', () => {
            const supportAdmin = { role: 'support_admin' };
            expect(hasPermission(supportAdmin, PERMISSIONS.SUPPORT_READ)).toBe(true);
            expect(hasPermission(supportAdmin, PERMISSIONS.SUPPORT_MANAGE)).toBe(true);
            expect(hasPermission(supportAdmin, PERMISSIONS.BILLING_REFUND)).toBe(false);
            expect(hasPermission(supportAdmin, PERMISSIONS.SETTINGS_UPDATE)).toBe(false);
        });

        test('ops_admin has jobs and audit permissions, but lacks billing refund or user modification', () => {
            const opsAdmin = { role: 'ops_admin' };
            expect(hasPermission(opsAdmin, PERMISSIONS.JOBS_READ)).toBe(true);
            expect(hasPermission(opsAdmin, PERMISSIONS.JOBS_RETRY)).toBe(true);
            expect(hasPermission(opsAdmin, PERMISSIONS.AUDIT_READ)).toBe(true);
            expect(hasPermission(opsAdmin, PERMISSIONS.BILLING_REFUND)).toBe(false);
            expect(hasPermission(opsAdmin, PERMISSIONS.USERS_UPDATE)).toBe(false);
        });

        test('standard candidate user has no admin permissions', () => {
            const candidate = { role: 'user' };
            expect(hasPermission(candidate, PERMISSIONS.USERS_READ)).toBe(false);
            expect(hasPermission(candidate, PERMISSIONS.BILLING_READ)).toBe(false);
            expect(hasPermission(candidate, PERMISSIONS.ANALYTICS_READ)).toBe(false);
        });
    });

    describe('2. Granular Middleware Enforcement (requirePermission)', () => {
        test('allows request if user role holds the required permission', async () => {
            const middleware = requirePermission(PERMISSIONS.BILLING_REFUND);
            const req = {
                user: { _id: new mongoose.Types.ObjectId(), username: 'billing_lead', role: 'billing_admin' },
                originalUrl: '/api/admin/payments/refund'
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();

            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('rejects request with 403 Forbidden and audits event if permission is missing', async () => {
            const middleware = requirePermission(PERMISSIONS.BILLING_REFUND);
            const req = {
                user: { _id: new mongoose.Types.ObjectId(), username: 'support_guy', role: 'support_admin' },
                originalUrl: '/api/admin/payments/refund'
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const next = jest.fn();
            const auditSpy = jest.spyOn(auditLogService, 'recordAdminAudit').mockResolvedValue({});

            await middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                requiredPermission: PERMISSIONS.BILLING_REFUND,
                currentRole: 'support_admin'
            }));
            expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({
                action: 'ACCESS_DENIED_PERMISSION',
                category: 'SECURITY',
                severity: 'WARN'
            }));
        });
    });

    describe('3. Privilege Escalation & Super-Admin Protection', () => {
        test('canManageTargetRole: rejects ordinary admin from assigning or managing super_admin', () => {
            const ordinaryAdmin = { role: 'admin' };
            const canManage = canManageTargetRole(ordinaryAdmin, 'super_admin');
            expect(canManage).toBe(false);
        });

        test('canManageTargetRole: allows super_admin to manage any role', () => {
            const superAdmin = { role: 'super_admin' };
            expect(canManageTargetRole(superAdmin, 'super_admin')).toBe(true);
            expect(canManageTargetRole(superAdmin, 'billing_admin')).toBe(true);
            expect(canManageTargetRole(superAdmin, 'admin')).toBe(true);
        });
    });
});

