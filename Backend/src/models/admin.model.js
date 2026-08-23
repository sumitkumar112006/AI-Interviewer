const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'super_admin'],
        default: 'admin'
    },
    isVerified: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const adminModel = mongoose.model("admins", adminSchema);

module.exports = adminModel;
