const jwt = require("jsonwebtoken");
const blacklistModel = require("../models/blacklist_model");    

async function authUser(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized, token not found in cookies"
        })
    }

    const isTokenBlacklisted = await blacklistModel.findOne({ token });

    if (isTokenBlacklisted) {
        return res.status(401).json({
            message: "token is invalid, please login again"
        })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        req.user = decoded

        next()
    } catch (err) {
        return res.status(401).json({
            message: "Invalid token"
        })
    }
}

module.exports = { authUser }