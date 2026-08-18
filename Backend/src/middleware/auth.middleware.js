const jwt = require("jsonwebtoken");
const blacklistModel = require("../models/blacklist_model");
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
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            message: "Invalid token"
        });
    }
}

module.exports = { authUser }