require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const multer = require('multer');
const { createRateLimiter } = require('./middleware/rateLimiter.middleware');

require('./middleware/rateLimiter.middleware');
const globalLimiter = createRateLimiter({
    prefix: 'ratelimit:global',
    windowSeconds: 60,
    maxRequests: 100,
    message: 'Too many requests from this IP address. Please try again later.'
});

const app = express();

function normalizeOrigin(origin) {
    return origin ? origin.trim().replace(/\/$/, "") : origin;
}

const allowedOrigins = [
    "https://resume-generator-production-2eae.up.railway.app",
    "https://ai-interviewer-silk.vercel.app",
    "http://localhost:5173",
    "https://ai-interviewer-git-main-amitk839170-gmailcoms-projects.vercel.app",
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim()) : [])
].map(normalizeOrigin).filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        const normalizedOrigin = normalizeOrigin(origin);

        if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
        }

        const corsError = new Error(`Origin ${origin} not allowed by CORS`);
        corsError.status = 403;
        return callback(corsError);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Global Rate Limiter
app.use(globalLimiter);


// Require all the routes here.
const { authRouter } = require('./routes/auth.route');
const interviewRouter = require('./routes/interview.route');
const coverLetterRouter = require('./routes/coverletter.route');
const adminRouter = require('./routes/admin.route');
const notificationRouter = require('./routes/notification.route');

// Use all the routes here.
app.use("/api/auth", authRouter);
app.use('/api/interview', interviewRouter);
app.use('/api/cover-letter', coverLetterRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationRouter);


app.use((err, req, res, next) => {
    if (err?.message?.includes("not allowed by CORS")) {
        return res.status(err.status || 403).json({
            message: err.message
        });
    }

    if (err instanceof multer.MulterError) {
        const message = err.code === "LIMIT_FILE_SIZE"
            ? "Resume PDF must be smaller than 3MB."
            : err.message;

        return res.status(400).json({ message });
    }

    if (err?.message === "Only PDF files are allowed.") {
        return res.status(400).json({ message: err.message });
    }


    let rawMessage = err?.message || "Internal server error";
    let statusCode = err?.status || err?.statusCode || 500;

    // 1. Detect Gemini 503 / UNAVAILABLE / High Demand / Quota errors
    if (
        statusCode === 503 ||
        rawMessage.includes("503") ||
        rawMessage.includes("UNAVAILABLE") ||
        rawMessage.includes("high demand") ||
        rawMessage.includes("RESOURCE_EXHAUSTED") ||
        rawMessage.includes("QUOTA") ||
        rawMessage.includes("overloaded")
    ) {
        statusCode = 503;
        rawMessage = "AI service is currently experiencing high demand. Please try again in a few seconds.";
    }
    // 2. Detect Zod validation errors or Mongoose Schema validation errors
    else if (
        err?.name === "ZodError" ||
        err?.name === "ValidationError" ||
        rawMessage.trim().startsWith("[") ||
        rawMessage.includes("too_small") ||
        rawMessage.includes("validation failed") ||
        rawMessage.includes("is required")
    ) {
        statusCode = 422;
        rawMessage = "The AI response was not structured properly. Please click 'Generate' again.";
    }
    // 3. Fallback for raw JSON error strings or unexpected backend errors
    else {
        if (rawMessage.trim().startsWith("{") || rawMessage.trim().startsWith("[")) {
            rawMessage = "An unexpected error occurred while generating. Please try again.";
        }
    }

    return res.status(statusCode).json({
        message: rawMessage
    });

});


module.exports = app;
