const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: [true, "Token is required to blacklist"],
        index: true
    }
}, {
    timestamps: true, // this will add createdAt and updatedAt fields automatically 
});

// Auto-delete blacklisted tokens from MongoDB after 24 hours (86400s)
blacklistSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const blacklistModel = mongoose.model("blacklistTokens", blacklistSchema);

module.exports = blacklistModel;