/**
 * rbac.js — Frontend Role-Based Access Control (RBAC) Utility
 *
 * Implements client-side permission checks to hide/disable unauthorized UI actions.
 * NOTE: Security is always enforced server-side.
 */

export const PERMISSIONS = Object.freeze({
    USERS_READ: 'users.read',
    USERS_UPDATE: 'users.update',
    USERS_SUSPEND: 'users.suspend',
    USERS_DELETE: 'users.delete',

    BILLING_READ: 'billing.read',
    BILLING_REFUND: 'billing.refund',
    BILLING_MANAGE: 'billing.manage',
    INVOICES_READ: 'invoices.read',

    EXPORTS_CREATE: 'exports.create',

    SUPPORT_READ: 'support.read',
    SUPPORT_MANAGE: 'support.manage',

    ANALYTICS_READ: 'analytics.read',

    AUDIT_READ: 'audit.read',

    JOBS_READ: 'jobs.read',
    JOBS_RETRY: 'jobs.retry',

    SETTINGS_READ: 'settings.read',
    SETTINGS_UPDATE: 'settings.update',

    ORGANIZATIONS_READ: 'organizations.read',
    ORGANIZATIONS_MANAGE: 'organizations.manage',

    MODERATION_READ: 'moderation.read',
    MODERATION_MANAGE: 'moderation.manage',

    ADMINS_MANAGE: 'admins.manage'
});

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS = Object.freeze({
    super_admin: ALL_PERMISSIONS,

    admin: [
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
    ],

    user_admin: [
        PERMISSIONS.USERS_READ,
        PERMISSIONS.USERS_UPDATE,
        PERMISSIONS.USERS_SUSPEND,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.ANALYTICS_READ,
        PERMISSIONS.MODERATION_READ,
        PERMISSIONS.MODERATION_MANAGE
    ],

    billing_admin: [
        PERMISSIONS.BILLING_READ,
        PERMISSIONS.BILLING_MANAGE,
        PERMISSIONS.BILLING_REFUND,
        PERMISSIONS.INVOICES_READ,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.ANALYTICS_READ
    ],

    support_admin: [
        PERMISSIONS.SUPPORT_READ,
        PERMISSIONS.SUPPORT_MANAGE,
        PERMISSIONS.USERS_READ,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.MODERATION_READ,
        PERMISSIONS.MODERATION_MANAGE
    ],

    ops_admin: [
        PERMISSIONS.JOBS_READ,
        PERMISSIONS.JOBS_RETRY,
        PERMISSIONS.AUDIT_READ,
        PERMISSIONS.SETTINGS_READ,
        PERMISSIONS.SETTINGS_UPDATE,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.ANALYTICS_READ,
        PERMISSIONS.ORGANIZATIONS_READ,
        PERMISSIONS.ORGANIZATIONS_MANAGE
    ],

    analytics_admin: [
        PERMISSIONS.ANALYTICS_READ,
        PERMISSIONS.EXPORTS_CREATE,
        PERMISSIONS.BILLING_READ,
        PERMISSIONS.USERS_READ,
        PERMISSIONS.JOBS_READ
    ],

    user: []
});

export const ROLE_METADATA = {
    super_admin: {
        label: 'Super Admin',
        desc: 'Unrestricted platform governance & administrative control',
        badgeClass: 'role-super'
    },
    admin: {
        label: 'Administrator',
        desc: 'General operational & platform administration',
        badgeClass: 'role-admin'
    },
    user_admin: {
        label: 'User Admin',
        desc: 'Candidate directory, profile updates & suspensions',
        badgeClass: 'role-user-admin'
    },
    billing_admin: {
        label: 'Billing Admin',
        desc: 'Payments, subscriptions, tax invoices & refunds',
        badgeClass: 'role-billing'
    },
    support_admin: {
        label: 'Support Admin',
        desc: 'Customer support tickets, triage & replies',
        badgeClass: 'role-support'
    },
    ops_admin: {
        label: 'Operations Admin',
        desc: 'Background jobs, worker monitoring & audit trail',
        badgeClass: 'role-ops'
    },
    analytics_admin: {
        label: 'Analytics Admin',
        desc: 'Metrics reports, usage trends & data exports',
        badgeClass: 'role-analytics'
    }
};

/**
 * Checks if the current administrative user holds a specific permission
 */
export function hasAdminPermission(user, permission) {
    if (!user) return false;
    if (user.isBlocked || user.isDeleted) return false;
    if (user.role === 'super_admin') return true;

    const rolePerms = ROLE_PERMISSIONS[user.role] || [];
    const customPerms = Array.isArray(user.customPermissions) ? user.customPermissions : [];
    const allUserPerms = new Set([...rolePerms, ...customPerms]);

    return allUserPerms.has(permission);
}

/**
 * Checks if the current administrative user holds at least one of the listed permissions
 */
export function hasAnyAdminPermission(user, permissions = []) {
    if (!user) return false;
    if (user.isBlocked || user.isDeleted) return false;
    if (user.role === 'super_admin') return true;

    return permissions.some(p => hasAdminPermission(user, p));
}

