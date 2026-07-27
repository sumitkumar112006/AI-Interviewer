const userModel = require("../models/user.model");
const blacklistModel = require("../models/blacklist_model");
const otpModel = require("../models/otp.model");
const bcrypt = require('bcryptjs');
const JWT = require('jsonwebtoken');
const { isEmailDomainReal } = require("../utils/emailValidator");
const { sendOtpEmail } = require("../services/email.service");

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000
};

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
 * @name registerUserController
 * @description expects {username, email, password} req
 * @access public
 */
async function registerUserController(req, res) {
    const { username, email, password } = req.body;
    try {
        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Provide all details carefully"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const isReal = await isEmailDomainReal(normalizedEmail);
        if (!isReal) {
            return res.status(400).json({
                message: "The email domain does not exist or cannot receive emails."
            });
        }

        const existingUser = await userModel.findOne({
            $or: [{ username }, { email: normalizedEmail }]
        });

        if (existingUser) {
            if (existingUser.username === username) {
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
            email: normalizedEmail,
            password: hash,
            isVerified: false
        });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Delete any existing OTP records for this email and save new one
        await otpModel.deleteMany({ email: normalizedEmail });
        await otpModel.create({ email: normalizedEmail, otp });

        // Send Email
        await sendOtpEmail(normalizedEmail, otp);

        return res.status(200).json({
            message: "Registration initiated! Please check your email for the verification OTP.",
            email: user.email,
            requiresOtp: true
        });
    } catch (err) {
        return handleAuthControllerError(res, err);
    }
}

/**
 * @name verifyOtpController
 * @description expects {email, otp} req
 * @access public
 */
async function verifyOtpController(req, res) {
    const { email, otp } = req.body;
    try {
        if (!email || !otp) {
            return res.status(400).json({
                message: "Email and OTP code are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const trimmedOtp = String(otp).trim();

        const validOtpRecord = await otpModel.findOne({ email: normalizedEmail, otp: trimmedOtp });
        if (!validOtpRecord) {
            return res.status(400).json({
                message: "Invalid or expired verification OTP code"
            });
        }

        const user = await userModel.findOneAndUpdate(
            { email: normalizedEmail },
            { isVerified: true },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                message: "User account not found"
            });
        }

        // Delete used OTP
        await otpModel.deleteOne({ _id: validOtpRecord._id });

        // Generate JWT token & login automatically
        const token = JWT.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.cookie("token", token, cookieOptions);

        return res.status(200).json({
            message: "Email verified and logged in successfully!",
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (err) {
        return handleAuthControllerError(res, err);
    }
}

/**
 * @name resendOtpController
 * @description expects {email} req
 * @access public
 */
async function resendOtpController(req, res) {
    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await userModel.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ message: "User account not found" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await otpModel.deleteMany({ email: normalizedEmail });
        await otpModel.create({ email: normalizedEmail, otp });

        await sendOtpEmail(normalizedEmail, otp);

        return res.status(200).json({
            message: "Verification OTP code resent to your email!",
            email: user.email
        });
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
        });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await userModel.findOne({
        email: normalizedEmail
    });

    if (!user) {
        return res.status(400).json({
            message: "Invalid email or password"
        });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        return res.status(400).json({
            message: "Please enter a valid password"
        });
    }

    const token = JWT.sign({ id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
        message: "User logged in successfully",
        user: {
            id: user._id,
            username: user.username
        }
    });
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
        });
    }

    await blacklistModel.create({
        token
    });

    res.clearCookie("token", cookieOptions);

    return res.status(200).json({
        message: "User logged out successfully"
    });
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
        const user = await userModel.findById(decoded.id).select("-password");

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
    verifyOtpController,
    resendOtpController,
    loginController,
    logoutController,
    getMeController,
};
