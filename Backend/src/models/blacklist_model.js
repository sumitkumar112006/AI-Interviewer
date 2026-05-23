const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required:[true, "Token is required to blacklist"],
    }
}, {
    timestamps: true, // this will add createdAt and updatedAt fields automatically 
}

)

const blacklistModel = mongoose.model("blacklistTokens", blacklistSchema);

module.exports = blacklistModel;