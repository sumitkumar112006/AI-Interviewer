const userModel = require("../models/user.model")
const blacklistModel = require("../models/blacklist_model")
const bcrypt = require('bcryptjs')
const JWT = require('jsonwebtoken')

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000
}

function handleAuthControllerError(res, err) {
    if (err?.code === 11000) {
        const duplicateField = Object.keys(err.keyPattern || {})[0];
        const normalizedField = duplicateField === "emain" ? "email" : duplicateField;

        return res.status(409).json({
            message: `${normalizedField || "User"} already exists`
        });
    }

    if (err?.name === "ValidationError") {
        return res.status(400).json({
            message: err.message
        });
    }

    return res.status(500).json({
        message: err?.message || "Internal server error"
    });
}

/**
 * @name resgisterUserController
 * @description expects {username email password} req 
 * @param {*} res 
 * @access public
 */
async function registerUserController(req, res) {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Provide all details carefully"
            })
        }

        const isUserAlreadyExists = await userModel.findOne({
            $or: [{ username }, { email }]
        })

        if (isUserAlreadyExists) {
            if (isUserAlreadyExists.username === username) {
                return res.status(409).json({
                    message: "Username already exists"
                });
            } else {
                return res.status(409).json({
                    message: "Email already exists"
                });
            }

        }

        const hash = await bcrypt.hash(password, 10);
        const user = await userModel.create({
            username,
            email,
            password: hash,
        })

        const token = JWT.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        )

        res.cookie("token", token, cookieOptions);

        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            }
        })
    } catch (err) {
        return handleAuthControllerError(res, err);
    }
}


/**
 * @name loginController
 * @description expects {email, password} req
 * @access public 
 */

async function loginController(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            message: "Provide all details carefully"
        })
    }

    const user = await userModel.findOne({
        email
    })
    if (!user) {
        return res.status(400).json({
            message: "User not found"
        })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
        return res.status(400).json({
            message: "Please enter a valid password"
        })
    }

    const token = JWT.sign({ id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )

    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
        message: "User logged in successfully",
        user: {
            id: user._id,
            username: user.username
        }
    })
}


/**
 * @name logoutController
 * @description clear token from user cookies and blacklist the token for future use.
 * @access public
 */

async function logoutController(req, res) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(400).json({
            message: "No token found"
        })
    }

    const tokenBlacklist = await blacklistModel.create({
        token
    })

    res.clearCookie("token", cookieOptions);

    return res.status(200).json({
        message: "User logged out successfully"
    })
}

/**
 * @name getMeController
 * @description get the current logged in user details
 * @access private
*/
async function getMeController(req, res) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(200).json({
            message: "No active session",
            user: null
        });
    }

    const isTokenBlacklisted = await blacklistModel.findOne({ token });

    if (isTokenBlacklisted) {
        res.clearCookie("token", cookieOptions);

        return res.status(200).json({
            message: "Session expired",
            user: null
        });
    }

    try {
        const decoded = JWT.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.id);

        if (!user) {
            res.clearCookie("token", cookieOptions);

            return res.status(200).json({
                message: "User not found",
                user: null
            });
        }

        return res.status(200).json({
            message: "User details fetched successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        res.clearCookie("token", cookieOptions);

        return res.status(200).json({
            message: "Invalid session",
            user: null
        });
    }
}

module.exports = {
    registerUserController,
    loginController,
    logoutController,
    getMeController,
}
