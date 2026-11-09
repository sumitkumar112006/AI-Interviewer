/**
 * session.controller.js — Controller for User & Admin Session Management
 *
 * Implements:
 * - User: GET /api/auth/sessions (own active sessions)
 * - User: POST /api/auth/sessions/:sessionId/revoke (revoke own session)
 * - User: POST /api/auth/sessions/revoke-others (revoke all except current session)
 * - Admin: GET /api/admin/users/:userId/sessions (inspect user sessions)
 * - Admin: POST /api/admin/sessions/:sessionId/revoke (admin revoke session)
 * - Admin: POST /api/admin/users/:userId/sessions/revoke-all (admin bulk revoke)
 */

'use strict';

const sessionService = require('../services/session.service');
const Session = require('../models/session.model');

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
};

/**
 * GET /api/auth/sessions
 * Authenticated user fetches their own active sessions
 */
async function getUserSessionsController(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }

        const sessions = await sessionService.getUserActiveSessions(userId, req.sessionId, false);

        return res.status(200).json({
            success: true,
            sessions,
            totalActive: sessions.length
        });
    } catch (err) {
        console.error('getUserSessionsController error:', err.message);
        return res.status(500).json({ message: "Failed to retrieve active sessions." });
    }
}

/**
 * POST /api/auth/sessions/:sessionId/revoke
 * Authenticated user revokes an individual session they own
 */
async function revokeUserSessionController(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ message: "Session ID is required." });
        }

        // Security check: verify ownership without trusting caller-supplied sessionId
        const targetSession = await Session.findOne({ sessionId });
        if (!targetSession) {
            return res.status(404).json({ message: "Session not found." });
        }

        if (String(targetSession.userId) !== String(userId)) {
            return res.status(403).json({ message: "You are not authorized to revoke this session." });
        }

        await sessionService.revokeSession(sessionId, {
            actorId: userId,
            actorRole: req.user?.role || 'user',
            isSelfRevoke: true,
            reason: 'Revoked by user',
            req
        });

        // If revoking the current session, clear cookie
        if (req.sessionId && req.sessionId === sessionId) {
            res.clearCookie("token", cookieOptions);
        }

        return res.status(200).json({
            success: true,
            message: "Session revoked successfully."
        });
    } catch (err) {
        console.error('revokeUserSessionController error:', err.message);
        return res.status(500).json({ message: "Failed to revoke session." });
    }
}

/**
 * POST /api/auth/sessions/revoke-others
 * Authenticated user revokes all their other sessions except current
 */
async function revokeOtherSessionsController(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required." });
        }

        const count = await sessionService.revokeAllUserSessions(userId, {
            actorId: userId,
            actorRole: req.user?.role || 'user',
            isSelfRevoke: true,
            reason: 'User revoked other sessions',
            exceptSessionId: req.sessionId || null,
            req
        });

        return res.status(200).json({
            success: true,
            message: `Revoked ${count} other active session(s).`,
            revokedCount: count
        });
    } catch (err) {
        console.error('revokeOtherSessionsController error:', err.message);
        return res.status(500).json({ message: "Failed to revoke other sessions." });
    }
}

/**
 * GET /api/admin/users/:userId/sessions
 * Administrator inspects sessions for a target user
 */
async function getAdminUserSessionsController(req, res) {
    try {
        const { userId } = req.params;
        const { status = 'ALL' } = req.query;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required." });
        }

        const sessions = await sessionService.getAdminUserSessions(userId, req.sessionId, { status });

        return res.status(200).json({
            success: true,
            sessions,
            total: sessions.length
        });
    } catch (err) {
        console.error('getAdminUserSessionsController error:', err.message);
        return res.status(500).json({ message: "Failed to retrieve user sessions." });
    }
}

/**
 * POST /api/admin/sessions/:sessionId/revoke
 * Administrator revokes an individual session
 */
async function revokeAdminSessionController(req, res) {
    try {
        const { sessionId } = req.params;
        const { reason = 'Revoked by administrator' } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({ message: "Session ID is required." });
        }

        const targetSession = await Session.findOne({ sessionId });
        if (!targetSession) {
            return res.status(404).json({ message: "Session not found." });
        }

        const adminId = req.user?.id || req.user?._id;
        const adminRole = req.user?.role || 'admin';

        await sessionService.revokeSession(sessionId, {
            actorId: adminId,
            actorRole: adminRole,
            isSelfRevoke: false,
            reason,
            req
        });

        return res.status(200).json({
            success: true,
            message: `Session "${sessionId}" revoked successfully.`
        });
    } catch (err) {
        console.error('revokeAdminSessionController error:', err.message);
        return res.status(500).json({ message: "Failed to revoke session." });
    }
}

/**
 * POST /api/admin/users/:userId/sessions/revoke-all
 * Administrator revokes all active sessions for a user
 */
async function revokeAllAdminUserSessionsController(req, res) {
    try {
        const { userId } = req.params;
        const { reason = 'All sessions revoked by administrator' } = req.body || {};

        if (!userId) {
            return res.status(400).json({ message: "User ID is required." });
        }

        const adminId = req.user?.id || req.user?._id;
        const adminRole = req.user?.role || 'admin';

        const count = await sessionService.revokeAllUserSessions(userId, {
            actorId: adminId,
            actorRole: adminRole,
            isSelfRevoke: false,
            reason,
            req
        });

        return res.status(200).json({
            success: true,
            message: `Revoked all ${count} active session(s) for user.`,
            revokedCount: count
        });
    } catch (err) {
        console.error('revokeAllAdminUserSessionsController error:', err.message);
        return res.status(500).json({ message: "Failed to revoke user sessions." });
    }
}

module.exports = {
    getUserSessionsController,
    revokeUserSessionController,
    revokeOtherSessionsController,
    getAdminUserSessionsController,
    revokeAdminSessionController,
    revokeAllAdminUserSessionsController
};

