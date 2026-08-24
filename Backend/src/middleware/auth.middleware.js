const jwt = require("jsonwebtoken");
const blacklistModel = require("../models/blacklist_model");
const userModel = require("../models/user.model");
const { isTokenBlacklistedInRedis } = require("../services/redis.service");

async function authUser(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized, token not found in cookies"
        });
    }

    // 1. Check Redis / in-memory store for instant token blacklist lookup (~1ms)
    let isBlacklisted = await isTokenBlacklistedInRedis(token);

    // 2. Fallback to MongoDB ONLY if Redis / in-memory store was unavailable (null)
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const account = await userModel.findById(decoded.id).select("username email plan role isBlocked customBonusCredits customAiBonusCredits blockedFeatures");

        if (!account) {
            return res.status(401).json({ message: "User account not found." });
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
            customBonusCredits: account.customBonusCredits || 0,
            customAiBonusCredits: account.customAiBonusCredits !== undefined ? account.customAiBonusCredits : 0,
            blockedFeatures: account.blockedFeatures || {
                aiAssistant: false,
                resumeGeneration: false,
                coverLetterGeneration: false,
                interviewReports: false
            }
        };

        next();
    } catch (err) {
        return res.status(401).json({
            message: "Invalid token"
        });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || (!req.user.isAdmin && !['admin', 'super_admin'].includes(req.user.role))) {
        return res.status(403).json({
            message: "Access denied. Administrator privileges required."
        });
    }
    next();
}

module.exports = { authUser, requireAdmin };