import config from "./app/config"
import { logger } from "./app/config/logger";
import mongoose from 'mongoose';
import app from './app';
import { redis } from "@/config/redis";
import { connectDB } from "@/config/db";
import { seedDefaultAdmin } from "./seeder";

async function main() {
  try {
    await connectDB()
    await seedDefaultAdmin()
    await redis.flushAll();
    logger.info('[Redis] Cache flushed successfully.');
    const server = app.listen(config.PORT, () => {
      logger.info(`[APP] Server is running on port ${config.PORT}`)
    })

    let isShuttingDown = false;
    const shutdown = () => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info('[APP] Shutting down gracefully...');
      server.close(async () => {
        logger.info('[APP] HTTP server closed.');
        await mongoose.disconnect();
        logger.info('[DB] Mongoose disconnected.');
        await redis.quit();
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    logger.error(`[APP] Application startup error: ${err}`);
    process.exit(1);
  }
}
main();