require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const multer = require('multer');
const { createRateLimiter } = require('./middleware/rateLimiter.middleware');

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
    "https://kivi-ai-production.up.railway.app",
    "https://ai-interviewer-silk.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://ai-interviewer-git-main-amitk839170-gmailcoms-projects.vercel.app",
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim()) : [])
].map(normalizeOrigin).filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        const normalizedOrigin = normalizeOrigin(origin);

        const isAllowed = allowedOrigins.includes(normalizedOrigin) || 
                          normalizedOrigin.endsWith('.vercel.app');

        if (isAllowed) {
            return callback(null, true);
        }

        const corsError = new Error(`Origin ${origin} not allowed by CORS`);
        corsError.status = 403;
        return callback(corsError);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-Razorpay-Signature", "X-Razorpay-Event-Id"]
};

app.use(cors(corsOptions));

// 1. Raw Webhook Endpoint mounted BEFORE standard JSON parser to preserve exact HMAC byte buffer
const webhookController = require('./controller/webhook.controller');
app.post(
    '/api/webhooks/razorpay',
    express.raw({ type: 'application/json' }),
    (req, res) => webhookController.handleRazorpayWebhook(req, res)
);

// 2. Global JSON and Cookie parser (with rawBody capture for any other signature checks)
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(cookieParser());

// Global Rate Limiter
app.use(globalLimiter);


// Require all routes
const { authRouter } = require('./routes/auth.route');
const interviewRouter = require('./routes/interview.route');
const coverLetterRouter = require('./routes/coverletter.route');
const adminRouter = require('./routes/admin.route');
const notificationRouter = require('./routes/notification.route');
const orderRouter = require('./routes/order.route');
const subscriptionRouter = require('./routes/subscription.route');
const invoiceRouter = require('./routes/invoice.route');
const jobRouter = require('./routes/job.route');

// Mount routes
app.use("/api/auth", authRouter);
app.use('/api/interview', interviewRouter);
app.use('/api/cover-letter', coverLetterRouter);
app.use('/api/jobs', jobRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/orders', orderRouter);
app.use('/api/subscriptions', subscriptionRouter);
app.use('/api/invoices', invoiceRouter);


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

    // Detect Gemini 503 / UNAVAILABLE / High Demand / Quota errors
    if (
        statusCode === 503 ||
        rawMessage.includes("503 Service Unavailable") ||
        rawMessage.includes("The model is overloaded") ||
        rawMessage.includes("Resource has been exhausted") ||
        rawMessage.includes("quota")
    ) {
        return res.status(503).json({
            message: "Our AI service is experiencing very high demand right now. Please wait a few seconds and try again.",
            retryAfterSeconds: 5
        });
    }

    // Normal Error Response
    return res.status(statusCode).json({
        message: rawMessage
    });
});

module.exports = app;
