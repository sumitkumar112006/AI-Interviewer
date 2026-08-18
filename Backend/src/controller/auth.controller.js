const userModel = require("../models/user.model");
const blacklistModel = require("../models/blacklist_model");
const otpModel = require("../models/otp.model");
const bcrypt = require('bcryptjs');
const JWT = require('jsonwebtoken');
const { isEmailDomainReal } = require("../utils/emailValidator");
const { sendOtpEmail } = require("../services/email.service");
const {
    blacklistTokenInRedis,
    isTokenBlacklistedInRedis
} = require("../services/redis.service");

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000
};

function handleAuthControllerError(res, err) {
    if (!err) {
        return res.status(400).json({ message: "An invalid authentication request occurred." });
    }

    if (err?.code === 11000) {
        const keyPattern = err.keyPattern || err.keyValue || {};
        const duplicateField = Object.keys(keyPattern)[0] || "field";
        const normalizedField = duplicateField === "emain" ? "email" : duplicateField;

        return res.status(409).json({
            message: `${normalizedField.charAt(0).toUpperCase() + normalizedField.slice(1)} already registered. Please log in or use a different one.`
        });
    }

    if (err?.name === "ValidationError") {
        const messages = err.errors ? Object.values(err.errors).map(e => e.message).join(", ") : err.message;
        return res.status(400).json({
            message: messages || "Invalid input data provided."
        });
    }

    if (err?.name === "CastError") {
        return res.status(400).json({
            message: `Invalid format for field: ${err.path}`
        });
    }

    console.error("[AUTH ERROR]", err);
    return res.status(400).json({
        message: err?.message || "Registration or authentication request failed. Please verify your details."
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
            // If existing user is NOT verified, update credentials and re-send fresh OTP instead of throwing 409
            if (!existingUser.isVerified) {
                // Rate limit check: restrict OTP generation to once every 2 minutes
                const activeOtp = await otpModel.findOne({ email: normalizedEmail });
                if (activeOtp) {
                    const elapsedSeconds = (Date.now() - new Date(activeOtp.createdAt).getTime()) / 1000;
                    const COOLDOWN_PERIOD = 120; // 2 minutes (120 seconds)
                    if (elapsedSeconds < COOLDOWN_PERIOD) {
                        const remaining = Math.ceil(COOLDOWN_PERIOD - elapsedSeconds);
                        return res.status(429).json({
                            message: `Please wait ${remaining} seconds before requesting another verification code.`
                        });
                    }
                }

                const hash = await bcrypt.hash(password, 10);
                existingUser.username = username;
                existingUser.email = normalizedEmail;
                existingUser.password = hash;
                await existingUser.save();

                // Generate 6-digit OTP
                const otp = Math.floor(100000 + Math.random() * 900000).toString();

                // Store OTP directly in DB
                await otpModel.deleteMany({ email: normalizedEmail });
                await otpModel.create({ email: normalizedEmail, otp });

                let sendResult = { success: false, fallbackOtp: otp };
                try {
                    sendResult = await sendOtpEmail(normalizedEmail, otp);
                } catch (emailErr) {
                    console.error("Email delivery warning:", emailErr.message);
                }

                return res.status(200).json({
                    message: "Registration initiated! Please check your email for the verification OTP.",
                    email: existingUser.email,
                    requiresOtp: true
                });
            }

            if (existingUser.username === username) {
                return res.status(409).json({
                    message: "Username already registered. Please log in or use a different username."
                });
            } else {
                return res.status(409).json({
                    message: "Email already registered. Please log in to your account."
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

        // Store OTP directly in DB
        await otpModel.deleteMany({ email: normalizedEmail });
        await otpModel.create({ email: normalizedEmail, otp });

        // Send Email
        let sendResult = { success: false, fallbackOtp: otp };
        try {
            sendResult = await sendOtpEmail(normalizedEmail, otp);
        } catch (emailErr) {
            console.error("Email delivery warning:", emailErr.message);
        }

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

        // Check MongoDB for active OTP
        let isValidOtp = false;
        const validOtpRecord = await otpModel.findOne({ email: normalizedEmail, otp: trimmedOtp });
        if (validOtpRecord) {
            // Ensure OTP is within strict 10-minute (600s) TTL window
            const ageInSeconds = (Date.now() - new Date(validOtpRecord.createdAt).getTime()) / 1000;
            if (ageInSeconds <= 600) {
                isValidOtp = true;
            }
        }

        if (!isValidOtp) {
            return res.status(400).json({
                message: "Invalid or expired verification OTP code"
            });
        }

        const user = await userModel.findOneAndUpdate(
            { email: normalizedEmail },
            { isVerified: true },
            { returnDocument: 'after' }
        );

        if (!user) {
            return res.status(404).json({
                message: "User account not found"
            });
        }

        // Delete used OTP from DB
        await otpModel.deleteMany({ email: normalizedEmail });

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

        // Rate limit check: restrict OTP generation to once every 2 minutes
        const activeOtp = await otpModel.findOne({ email: normalizedEmail });
        if (activeOtp) {
            const elapsedSeconds = (Date.now() - new Date(activeOtp.createdAt).getTime()) / 1000;
            const COOLDOWN_PERIOD = 120; // 2 minutes (120 seconds)
            if (elapsedSeconds < COOLDOWN_PERIOD) {
                const remaining = Math.ceil(COOLDOWN_PERIOD - elapsedSeconds);
                return res.status(429).json({
                    message: `Please wait ${remaining} seconds before requesting another verification code.`
                });
            }
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await otpModel.deleteMany({ email: normalizedEmail });
        await otpModel.create({ email: normalizedEmail, otp });

        let sendResult = { success: false, fallbackOtp: otp };
        try {
            sendResult = await sendOtpEmail(normalizedEmail, otp);
        } catch (emailErr) {
            console.error("Email delivery warning:", emailErr.message);
        }

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
    try {
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

        if (!user.isVerified) {
            // Send a fresh OTP to the unverified user
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            await otpModel.deleteMany({ email: normalizedEmail });
            await otpModel.create({ email: normalizedEmail, otp });

            let sendResult = { success: false, fallbackOtp: otp };
            try {
                sendResult = await sendOtpEmail(normalizedEmail, otp);
            } catch (emailErr) {
                console.error("Email delivery warning:", emailErr.message);
            }

            let message = "Your email is not verified yet. A new verification OTP code has been sent to your email.";
            if (!sendResult?.success && sendResult?.fallbackOtp) {
                message = `Your email is not verified yet. Verification code: ${sendResult.fallbackOtp}`;
            }

            return res.status(403).json({
                message,
                requiresOtp: true,
                email: user.email,
                fallbackOtp: sendResult?.fallbackOtp
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
    } catch (err) {
        return handleAuthControllerError(res, err);
    }
}

/**
 * @name logoutController
 * @description clear token from user cookies and blacklist the token in Redis & DB.
 * @access public
 */
async function logoutController(req, res) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(400).json({
            message: "No token found"
        });
    }

    // Blacklist token in Redis (24hr TTL) & DB
    await blacklistTokenInRedis(token, 86400);
    await blacklistModel.create({ token });

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

    let isBlacklisted = await isTokenBlacklistedInRedis(token);
    if (!isBlacklisted) {
        const isTokenBlacklisted = await blacklistModel.findOne({ token });
        if (isTokenBlacklisted) isBlacklisted = true;
    }

    if (isBlacklisted) {
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
