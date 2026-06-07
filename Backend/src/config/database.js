const mongoose = require('mongoose');

async function removeLegacyUserIndexes() {
    try {
        const usersCollection = mongoose.connection.db.collection('users');
        const indexes = await usersCollection.indexes();
        const legacyEmailIndex = indexes.find(index => index.name === 'emain_1');

        if (!legacyEmailIndex) {
            return;
        }

        await usersCollection.dropIndex(legacyEmailIndex.name);
        console.log(`Dropped legacy index: ${legacyEmailIndex.name}`);
    } catch (err) {
        if (err?.codeName === "NamespaceNotFound") {
            return;
        }

        throw err;
    }
}

async function connectToDB() {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not configured");
    }

    try {
        await mongoose.connect(process.env.MONGO_URI)
        await removeLegacyUserIndexes();
        console.log("connected to database")
    } catch (err) {
        console.log("Database not connected : ", err)
        throw err;
    }
}

module.exports = connectToDB;
