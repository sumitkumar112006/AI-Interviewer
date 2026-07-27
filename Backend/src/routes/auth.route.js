const { Router } = require("express");
const { 
    registerUserController, 
    verifyOtpController, 
    resendOtpController, 
    loginController, 
    logoutController, 
    getMeController 
} = require("../controller/auth.controller");

const authRouter = Router();

/**
 * @route POST /api/auth/register
 * @description register new user & send OTP code to email
 * @access Public
 */
authRouter.post("/register", registerUserController);

/**
 * @route POST /api/auth/verify-otp
 * @description verify email via 6-digit OTP code & activate user account
 * @access Public
 */
authRouter.post("/verify-otp", verifyOtpController);

/**
 * @route POST /api/auth/resend-otp
 * @description resend verification OTP code to email
 * @access Public
 */
authRouter.post("/resend-otp", resendOtpController);

/**
 * @route POST /api/auth/login
 * @description login user with email and password
 * @access Public
 */
authRouter.post("/login", loginController);

/**
 * @route GET /api/auth/logout
 * @description clear token from user cookies and blacklist the token for future use.
 * @access Public
 */
authRouter.get("/logout", logoutController);

/**
 * @route GET /api/auth/get-me
 * @description get the current logged in user details
 * @access Private
 */
authRouter.get("/get-me", getMeController);

module.exports = { authRouter };
