const mongoose = require('mongoose');
const coverLetterSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    interviewReport: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "InterviewReports"
    },
    resume: {
        type: String,
        required: true
    },
    jobDescription: {
        type: String,
        required: true
    },
    selfDescription: {
        type: String,
    },
    companyName: {
        type: String,
        trim: true
    },
    roleName: {
        type: String,
        trim: true
    },
    generatedContent: {
        type: String, // Can store HTML/Markdown or raw text
        required: true
    }
}, {
    timestamps: true
});
const coverLetterModel = mongoose.model("CoverLetters", coverLetterSchema);
module.exports = coverLetterModel;