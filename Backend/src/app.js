const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const multer = require('multer');

const app = express();

function normalizeOrigin(origin) {
    return origin ? origin.trim().replace(/\/$/, "") : origin;
}

const allowedOrigins = [
    "https://ai-interviewer-kzwc.onrender.com",
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


// Require all the routes here.
const { authRouter } = require('./routes/auth.route');
const interviewRouter = require('./routes/interview.route');

// Use all the routes here.
app.use("/api/auth", authRouter);
app.use('/api/interview', interviewRouter)

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

    console.error(err);

    return res.status(err.status || 500).json({
        message: err.message || "Internal server error"
    });
});


module.exports = app;
