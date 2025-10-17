import config from "./app/config"
import { logger } from "./app/config/logger";
import "./app/config/moduleAlias"
import mongoose from 'mongoose';
import app from './app';
// import { seedDatabase } from "./seeder";
async function main() {
  try {
    await mongoose.connect(config.DATABASE_URL as string);
    logger.info('[DB] Database connected successfully');
    // await seedDatabase();
    app.listen(config.PORT, () => {
      logger.info(`[SERVER] Server is running on port ${config.PORT}`)
    })

  } catch (err) {
    logger.error(`[DB] Database connection error: ${err}`);
  }
}
main();