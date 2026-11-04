require('dotenv').config();
// Initialize OpenTelemetry SDK before Express, Mongoose, ioredis, or any other application modules are imported
require('./src/instrumentation');
const app = require('./src/app');
const connectToDB = require('./src/config/database');
const { connectToRedis, closeRedis } = require('./src/config/redis');
const { initAiWorker, closeAiWorker } = require('./src/jobs/aiWorker');
const { closeAiQueue } = require('./src/jobs/aiQueue');
const reconciliationService = require('./src/services/reconciliation.service');
const { setupGracefulShutdown } = require('./src/utils/gracefulShutdown');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await connectToDB();
        connectToRedis();   // Connect Redis (Railway / local)

        // Initialize BullMQ background worker for decoupled AI jobs
        initAiWorker();

        // Start payment background jobs (Order expiry & Missed webhook reconciliation)
        reconciliationService.startBackgroundCron();

        const server = app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        // Setup production-ready graceful shutdown for API and BullMQ worker
        setupGracefulShutdown({
            server,
            closeAiWorker,
            closeAiQueue,
            reconciliationService,
            closeRedis,
            closeDB: connectToDB.closeDB
        });

        return server;
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = { startServer };
