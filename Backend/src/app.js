const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://ai-interviewer-kzwc.onrender.com",
    "https://ai-interviewer-silk.vercel.app/",
    ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim()) : [])
].filter(Boolean);

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true
}))


// Require all the routes here.
const { authRouter } = require('./routes/auth.route');
const interviewRouter = require('./routes/interview.route');

// Use all the routes here.
app.use("/api/auth", authRouter);
app.use('/api/interview', interviewRouter)



module.exports = app;
