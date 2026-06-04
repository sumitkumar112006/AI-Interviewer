require('dotenv').config();
const app = require('./src/app');
const connectToDB = require('./src/config/database')

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await connectToDB();

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
}

startServer();
