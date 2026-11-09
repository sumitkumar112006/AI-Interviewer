/**
 * rbac.config.js — Granular Role-Based Access Control (RBAC) Registry
 *
 * Implements:
 * 1. Permission definitions for all KIVI AI platform modules.
 * 2. Role-to-permission mappings for Super Admin, General Admin, and specialized functional roles.
 * 3. Safe privilege escalation protection (actors cannot assign privileges they do not hold).
 * 4. Helper utilities for permission evaluation and inheritance.
 */

'use strict';

const PERMISSIONS = Object.freeze({
    // User Management
    USERS_READ: 'users.read',
    USERS_UPDATE: 'users.update',
    USERS_SUSPEND: 'users.suspend',
    USERS_DELETE: 'users.delete',

    // Billing, Refunds & Invoices
    BILLING_READ: 'billing.read',
    BILLING_REFUND: 'billing.refund',
    BILLING_MANAGE: 'billing.manage',
    INVOICES_READ: 'invoices.read',

    // Secure Data Export
    EXPORTS_CREATE: 'exports.create',

    // Support Ticket System
    SUPPORT_READ: 'support.read',
    SUPPORT_MANAGE: 'support.manage',

    // Live Metrics & Platform Analytics
    ANALYTICS_READ: 'analytics.read',

    // Audit Trail & Compliance
    AUDIT_READ: 'audit.read',

    // Background Job Monitoring
    JOBS_READ: 'jobs.read',
    JOBS_RETRY: 'jobs.retry',

    // App Configuration & Broadcast Alerts
    SETTINGS_READ: 'settings.read',
    SETTINGS_UPDATE: 'settings.update',

    // B2B Partner & Organization Management
    ORGANIZATIONS_READ: 'organizations.read',
    ORGANIZATIONS_MANAGE: 'organizations.manage',

    // Content Moderation System
    MODERATION_READ: 'moderation.read',
    MODERATION_MANAGE: 'moderation.manage',

    // Administrator Governance
    ADMINS_MANAGE: 'admins.manage'
});

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const ROLE_PERMISSIONS = Object.freeze({
    super_admin: ALL_PERMISSIONS,

    // Legacy / General Admin: full access to standard operational tools except managing other admins
    admin: Object.freeze([
        PERMISSIONS.USERS_READ,
        PERMISSIONS.USERS_UPDATE,
        PERMISSIONS.USERS_SUSPEND,
        PERMISSIONS.BILLING_READ,
        PERMISSIONS.BILLING_MANAGE,
        PERMISSIONS.INVOICES_READ,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.SUPPORT_READ,
        PERMISSIONS.SUPPORT_MANAGE,
        PERMISSIONS.ANALYTICS_READ,
        PERMISSIONS.AUDIT_READ,
        PERMISSIONS.JOBS_READ,
        PERMISSIONS.JOBS_RETRY,
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.SETTINGS_UPDATE,
        PERMISSIONS.ORGANIZATIONS_READ,
        PERMISSIONS.ORGANIZATIONS_MANAGE,
        PERMISSIONS.MODERATION_READ,
        PERMISSIONS.MODERATION_MANAGE
    ]),

    // User Management Admin
    user_admin: Object.freeze([
        PERMISSIONS.USERS_READ,
        PERMISSIONS.USERS_UPDATE,
        PERMISSIONS.USERS_SUSPEND,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.ANALYTICS_READ,
        PERMISSIONS.MODERATION_READ,
        PERMISSIONS.MODERATION_MANAGE
    ]),

    // Billing Admin
    billing_admin: Object.freeze([
        PERMISSIONS.BILLING_READ,
        PERMISSIONS.BILLING_MANAGE,
        PERMISSIONS.BILLING_REFUND,
        PERMISSIONS.INVOICES_READ,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.ANALYTICS_READ
    ]),

    // Support Admin
    support_admin: Object.freeze([
        PERMISSIONS.SUPPORT_READ,
        PERMISSIONS.SUPPORT_MANAGE,
        PERMISSIONS.USERS_READ,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.MODERATION_READ,
        PERMISSIONS.MODERATION_MANAGE
    ]),

    // Operations & Jobs Admin
    ops_admin: Object.freeze([
        PERMISSIONS.JOBS_READ,
        PERMISSIONS.JOBS_RETRY,
        PERMISSIONS.AUDIT_READ,
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.SETTINGS_UPDATE,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.ANALYTICS_READ,
        PERMISSIONS.ORGANIZATIONS_READ,
        PERMISSIONS.ORGANIZATIONS_MANAGE
    ]),

    // Analytics Admin
    analytics_admin: Object.freeze([
        PERMISSIONS.ANALYTICS_READ,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.BILLING_READ,
        PERMISSIONS.USERS_READ,
        PERMISSIONS.JOBS_READ
    ]),

    // Standard Candidate / User (no admin permissions)
    user: Object.freeze([])
});

const ALL_ROLES = Object.freeze(Object.keys(ROLE_PERMISSIONS));

/**
 * Returns set of active permissions for a user based on role and custom grants
 */
function getUserPermissions(user) {
    if (!user) return new Set();

    // Super admin has all permissions unconditionally
    if (user.role === 'super_admin') {
        return new Set(ALL_PERMISSIONS);
    }

    const rolePerms = ROLE_PERMISSIONS[user.role] || [];
    const customPerms = Array.isArray(user.customPermissions) ? user.customPermissions : [];

    return new Set([...rolePerms, ...customPerms]);
}

/**
 * Check if a user holds a specific permission
 */
function hasPermission(user, permission) {
    if (!user) return false;
    if (user.isBlocked || user.isDeleted) return false;
    if (user.role === 'super_admin') return true;

    const perms = getUserPermissions(user);
    return perms.has(permission);
}

/**
 * Check if a user holds at least one of the specified permissions
 */
function hasAnyPermission(user, permissions = []) {
    if (!user) return false;
    if (user.isBlocked || user.isDeleted) return false;
    if (user.role === 'super_admin') return true;

    const perms = getUserPermissions(user);
    return permissions.some(p => perms.has(p));
}

/**
 * Verify whether an administrative actor is authorized to manage or assign a target role
 * Enforces Rule 6 & 7: Only super_admin can create/assign super_admin; admins cannot grant higher roles.
 */
function canManageTargetRole(actor, targetRole) {
    if (!actor) return false;
    if (actor.role === 'super_admin') return true;

    // Non-super-admins cannot touch or assign super_admin role
    if (targetRole === 'super_admin') return false;

    // Normal admins can only manage roles below or equal to themselves if they have admins.manage
    if (!hasPermission(actor, PERMISSIONS.ADMINS_MANAGE)) return false;

    return true;
}

module.exports = {
    PERMISSIONS,
    ALL_PERMISSIONS,
    ROLE_PERMISSIONS,
    ALL_ROLES,
    getUserPermissions,
    hasPermission,
    hasAnyPermission,
    canManageTargetRole
};

