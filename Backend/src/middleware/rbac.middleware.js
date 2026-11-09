/**
 * rbac.middleware.js — Granular Permission Enforcement Middleware
 *
 * Implements:
 * 1. Declarative permission requirement guards for route endpoints.
 * 2. Automatic privilege escalation detection and logging.
 * 3. Graceful 403 Forbidden responses with missing permission diagnostics.
 */

'use strict';

const { hasPermission, hasAnyPermission, PERMISSIONS } = require('../config/rbac.config');
const auditLogService = require('../services/auditLog.service');

/**
 * Middleware factory requiring a specific granular permission
 * @param {string} requiredPermission - Permission string (e.g. 'users.read')
 */
function requirePermission(requiredPermission) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        if (req.user.isBlocked || req.user.isDeleted) {
            return res.status(403).json({ message: 'Account suspended or archived.' });
        }

        const authorized = hasPermission(req.user, requiredPermission);

        if (!authorized) {
            // Log security event to Admin Audit Trail
            await auditLogService.recordAdminAudit({
                req,
                action: 'ACCESS_DENIED_PERMISSION',
                category: 'SECURITY',
                severity: 'WARN',
                targetType: 'API_Endpoint',
                targetIdentifier: req.originalUrl,
                changeSummary: `User "${req.user.username}" (${req.user.role}) denied access to "${req.originalUrl}". Missing permission: "${requiredPermission}".`
            });

            return res.status(403).json({
                success: false,
                message: `Access denied. You lack the required "${requiredPermission}" permission.`,
                requiredPermission,
                currentRole: req.user.role
            });
        }

        next();
    };
}

/**
 * Middleware factory requiring at least ONE of the listed permissions
 * @param {string[]} permissions - Array of permission strings
 */
function requireAnyPermission(permissions = []) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        if (req.user.isBlocked || req.user.isDeleted) {
            return res.status(403).json({ message: 'Account suspended or archived.' });
        }

        const authorized = hasAnyPermission(req.user, permissions);

        if (!authorized) {
            await auditLogService.recordAdminAudit({
                req,
                action: 'ACCESS_DENIED_PERMISSION',
                category: 'SECURITY',
                severity: 'WARN',
                targetType: 'API_Endpoint',
                targetIdentifier: req.originalUrl,
                changeSummary: `User "${req.user.username}" (${req.user.role}) denied access to "${req.originalUrl}". Missing any of: [${permissions.join(', ')}].`
            });

            return res.status(403).json({
                success: false,
                message: `Access denied. Requires one of: [${permissions.join(', ')}].`,
                requiredPermissions: permissions,
                currentRole: req.user.role
            });
        }

        next();
    };
}

module.exports = {
    requirePermission,
    requireAdminPermission: requirePermission,
    requireAnyPermission,
    PERMISSIONS
};

