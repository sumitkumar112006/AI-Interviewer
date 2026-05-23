const { Router } = require("express");
const { registerUserController, loginController, logoutController, getMeController } = require("../controller/auth.controller");
const { authUser } = require('../middleware/auth.middleware')

const authRouter = Router();



/**
 * @route POST /api/auth/register
 * @description register new user
 * @access Public
 */

authRouter.post("/register", registerUserController);



/**
 * @Route POST /api/auth/login
 * @description login user with email and password`
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

authRouter.get("/get-me", authUser, getMeController)

module.exports = { authRouter }