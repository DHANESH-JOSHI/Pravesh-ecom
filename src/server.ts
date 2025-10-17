import config from "./app/config"
import { logger } from "./app/config/logger";
import mongoose from 'mongoose';
import app from './app';
import { redis } from "@/config/redis";

async function main() {
  try {
    await mongoose.connect(config.DATABASE_URL as string);
    logger.info('[DB] Database connected successfully');

    await redis.connect();

    app.listen(config.PORT, () => {
      logger.info(`[APP] Server is running on port ${config.PORT}`)
    })

  } catch (err) {
    logger.error(`[APP] Application startup error: ${err}`);
    process.exit(1);
  }
}
main();