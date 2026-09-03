const { Router } = require("express");
const {
    registerUserController,
    verifyOtpController,
    resendOtpController,
    loginController,
    logoutController,
    getMeController,
    forgotPasswordController,
    resetPasswordController,
    getUserUsageController,
    googleSupabaseAuthController
} = require("../controller/auth.controller");

const { createRateLimiter } = require("../middleware/rateLimiter.middleware")

const authLoginLimiter = createRateLimiter({
    prefix: 'ratelimit:auth:login',
    windowSeconds: 60, 
    maxRequests: 5,
    message: 'Login attempt limit reached. Please wait a minute before trying again.'
});

const registerLimiter = createRateLimiter({
    prefix: 'ratelimit:auth:register',
    windowSeconds: 60,
    maxRequests: 5,
    message: 'Registration limit reached. Please wait a minute before trying again.'
});

const resendOtpLimiter = createRateLimiter({
    prefix: 'ratelimit:auth:resend-otp',
    windowSeconds: 60,
    maxRequests: 3,
    message: 'Too many OTP requests. Please wait a minute before trying again.'
});

const forgotPasswordLimiter = createRateLimiter({
    prefix: 'ratelimit:auth:forgot-password',
    windowSeconds: 60,
    maxRequests: 3,
    message: 'Too many password reset requests. Please wait a minute before trying again.'
});

const resetPasswordLimiter = createRateLimiter({
    prefix: 'ratelimit:auth:reset-password',
    windowSeconds: 60,
    maxRequests: 5,
    message: 'Too many reset attempts. Please wait a minute before trying again.'
});

const googleAuthLimiter = createRateLimiter({
    prefix: 'ratelimit:auth:google',
    windowSeconds: 60,
    maxRequests: 10,
    message: 'Too many Google sign-in attempts. Please wait a minute.'
});

const authRouter = Router();

/**
 * @route POST /api/auth/google-supabase
 * @description authenticate user using Supabase Google OAuth access token
 * @access Public
 */
authRouter.post("/google-supabase", googleAuthLimiter, googleSupabaseAuthController);

/**
 * @route POST /api/auth/register
 * @description register new user & send OTP code to email
 * @access Public
 */
authRouter.post("/register", registerLimiter,registerUserController);

/**
 * @route POST /api/auth/verify-otp
 * @description verify email via 6-digit OTP code & activate user account
 * @access Public
 */
authRouter.post("/verify-otp",verifyOtpController);

/**
 * @route POST /api/auth/resend-otp
 * @description resend verification OTP code to email
 * @access Public
 */
authRouter.post("/resend-otp", resendOtpLimiter, resendOtpController);

/**
 * @route POST /api/auth/login
 * @description login user with email and password
 * @access Public
 */
authRouter.post("/login", authLoginLimiter, loginController);

/**
 * @route POST /api/auth/forgot-password
 * @description send 6-digit password reset OTP to email
 * @access Public
 */
authRouter.post("/forgot-password", forgotPasswordLimiter, forgotPasswordController);

/**
 * @route POST /api/auth/reset-password
 * @description verify reset OTP and set new password
 * @access Public
 */
authRouter.post("/reset-password", resetPasswordLimiter, resetPasswordController);

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

/**
 * @route GET /api/auth/usage
 * @description get remaining generation & AI attempt counts for user
 * @access Private
 */
authRouter.get("/usage", getUserUsageController);

module.exports = { authRouter };
