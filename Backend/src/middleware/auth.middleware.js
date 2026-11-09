const jwt = require("jsonwebtoken");
const blacklistModel = require("../models/blacklist_model");
const userModel = require("../models/user.model");
const { isTokenBlacklistedInRedis } = require("../services/redis.service");
const { touchUserActivity } = require("../services/userActivity.service");
const sessionService = require("../services/session.service");

async function authUser(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized, token not found in cookies"
        });
    }

    // 1. Validate JWT signature and expiration first (zero-cost in-memory crypto check)
    // Avoids querying Redis for expired, corrupted, or forged tokens
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
        return res.status(401).json({
            message: jwtErr.name === 'TokenExpiredError' 
                ? "Token has expired, please login again" 
                : "Unauthorized, invalid token"
        });
    }

    // 2. Check session revocation (fast Redis lookup with Mongo fallback)
    const sessionRevoked = await sessionService.isSessionRevoked(decoded.sid, decoded.id, decoded.iat);
    if (sessionRevoked) {
        return res.status(401).json({
            message: "Session has been revoked. Please log in again.",
            sessionRevoked: true
        });
    }

    // 3. Check Redis / in-memory store for instant token revocation/blacklist lookup
    let isBlacklisted = await isTokenBlacklistedInRedis(token);

    // 4. Fallback to MongoDB ONLY if Redis / in-memory store was unavailable (null)
    if (isBlacklisted === null) {
        const mongoBlacklist = await blacklistModel.findOne({ token });
        if (mongoBlacklist) {
            isBlacklisted = true;
        }
    }

    if (isBlacklisted) {
        return res.status(401).json({
            message: "Token is invalid, please login again"
        });
    }

    try {
        const account = await userModel.findById(decoded.id).select("username email plan role isBlocked isDeleted customBonusCredits customAiBonusCredits blockedFeatures careerProfile organization organizationRole");

        if (!account || account.isDeleted) {
            return res.status(401).json({ message: "User account not found or has been deactivated." });
        }

        const isAdminAccount = ['admin', 'super_admin'].includes(account.role);

        if (!isAdminAccount && account.isBlocked) {
            return res.status(403).json({
                message: "Your account has been suspended by an administrator. Please contact support."
            });
        }

        req.user = {
            id: account._id.toString(),
            username: account.username,
            email: account.email,
            plan: account.plan || 'free',
            role: account.role || 'user',
            isAdmin: isAdminAccount,
            isBlocked: account.isBlocked || false,
            organization: account.organization ? account.organization.toString() : null,
            organizationRole: account.organizationRole || null,
            customBonusCredits: account.customBonusCredits || 0,
            customAiBonusCredits: account.customAiBonusCredits !== undefined ? account.customAiBonusCredits : 0,
            blockedFeatures: account.blockedFeatures || {
                aiAssistant: false,
                resumeGeneration: false,
                coverLetterGeneration: false,
                interviewReports: false
            },
            careerProfile: account.careerProfile || {
                selfDescription: "",
                targetRole: "Full Stack Developer",
                targetCompanies: ["Product Companies"],
                experienceLevel: "fresher",
                savedRoadmaps: []
            }
        };

        req.sessionId = decoded.sid || null;

        // Throttled session activity update
        if (decoded.sid) {
            sessionService.touchSession(decoded.sid);
        }

        // Asynchronously record authenticated user activity with two-tier throttling
        touchUserActivity(account._id);

        next();
    } catch (err) {
        return res.status(401).json({
            message: "Invalid token"
        });
    }
}

const ADMIN_ROLES = [
    'admin', 
    'super_admin', 
    'user_admin', 
    'billing_admin', 
    'support_admin', 
    'ops_admin', 
    'analytics_admin'
];

function requireAdmin(req, res, next) {
    if (!req.user || req.user.isBlocked || (!req.user.isAdmin && !ADMIN_ROLES.includes(req.user.role))) {
        return res.status(403).json({
            message: "Access denied. Administrator privileges required."
        });
    }
    next();
}

function requireSuperAdmin(req, res, next) {
    if (!req.user || req.user.isBlocked || req.user.role !== 'super_admin') {
        return res.status(403).json({
            message: "Access denied. Super Administrator privileges required."
        });
    }
    next();
}

async function optionalAuth(req, res, next) {
    const token = req.cookies?.token;
    if (!token) {
        req.user = null;
        return next();
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const account = await userModel.findById(decoded.id).select("username email plan role isBlocked isDeleted");
        if (account && !account.isDeleted && !account.isBlocked) {
            req.user = account;
        } else {
            req.user = null;
        }
    } catch (_) {
        req.user = null;
    }
    return next();
}

/**
 * Middleware: Enforces B2B Tenant Isolation
 * Allows Platform Admins (super_admin, admin, ops_admin) OR Org Admins belonging to target orgId
 */
function requireOrgAccess(paramKey = 'orgId') {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required." });
        }

        // Platform administrators have global cross-tenant access
        const isPlatformAdmin = req.user.isAdmin || ['admin', 'super_admin', 'ops_admin'].includes(req.user.role);
        if (isPlatformAdmin) {
            return next();
        }

        const targetOrgId = req.params[paramKey] || req.body?.organizationId || req.query?.organizationId;
        if (!targetOrgId) {
            return res.status(400).json({ message: "Organization ID is required." });
        }

        // Organization admins can only access their own organization
        const userOrg = req.user.organization ? String(req.user.organization) : null;
        const isOrgAdmin = req.user.organizationRole === 'admin';

        if (userOrg && userOrg === String(targetOrgId) && isOrgAdmin) {
            return next();
        }

        return res.status(403).json({
            message: "Access denied. You are not authorized to view or manage this organization."
        });
    };
}

module.exports = { authUser, requireAdmin, requireSuperAdmin, requireOrgAccess, optionalAuth };