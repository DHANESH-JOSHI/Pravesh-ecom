"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("./app/config"));
const logger_1 = require("./app/config/logger");
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = __importDefault(require("./app"));
const redis_1 = require("./app/config/redis");
const db_1 = require("./app/config/db");
// import { seedDefaultAdmin } from "./seeder";
async function main() {
    try {
        await (0, db_1.connectDB)();
        // await seedDefaultAdmin()
        await redis_1.redis.flushAll();
        logger_1.logger.info('[Redis] Cache flushed successfully.');
        const server = app_1.default.listen(config_1.default.PORT, () => {
            logger_1.logger.info(`[APP] Server is running on port ${config_1.default.PORT}`);
        });
        let isShuttingDown = false;
        const shutdown = () => {
            if (isShuttingDown)
                return;
            isShuttingDown = true;
            logger_1.logger.info('[APP] Shutting down gracefully...');
            server.close(async () => {
                logger_1.logger.info('[APP] HTTP server closed.');
                await mongoose_1.default.disconnect();
                logger_1.logger.info('[DB] Mongoose disconnected.');
                await redis_1.redis.quit();
                process.exit(0);
            });
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }
    catch (err) {
        logger_1.logger.error(`[APP] Application startup error: ${err}`);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=server.js.map