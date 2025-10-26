import mongoose from 'mongoose';
import config from './index';
import { logger } from './logger';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    logger.info('[DB] Using existing database connection');
    return;
  }

  try {
    await mongoose.connect(config.DATABASE_URL as string);
    isConnected = true;
    logger.info('[DB] Database connected successfully');
  } catch (error) {
    logger.error('[DB] Database connection error:', error);
    throw error;
  }
};
