import { createClient } from 'redis';
import config from './index';
import { logger } from './logger';

const client = createClient({ url: config.REDIS_URL });

client.on('connect', () => logger.info('[Redis] Connecting...'));
client.on('ready', () => logger.info('[Redis] Connected successfully.'));
client.on('error', () => logger.error('[Redis] Connection error'));
client.on('end', () => logger.warn('[Redis] Connection closed.'));

const CACHE_TTL = 900;

export const redis = {
  async connect() {
    if (!client.isOpen) await client.connect();
  },

  async get<T>(key: string): Promise<T | null> {
    await this.connect();
    const data = await client.get(key);
    if (data) {
      logger.info(`[Redis] CACHE HIT for key: ${key}`);
      return JSON.parse(data) as T;
    } else {
      logger.info(`[Redis] CACHE MISS for key: ${key}`);
      return null;
    }
  },

  async set<T>(key: string, value: T, ttl: number = CACHE_TTL): Promise<boolean> {
    await this.connect();
    const result = await client.set(key, JSON.stringify(value), { EX: ttl });
    return result === 'OK';
  },

  async delete(key: string): Promise<boolean> {
    await this.connect();
    const result = await client.del(key);
    return result > 0;
  },

  async deleteByPattern(pattern: string): Promise<number> {
    await this.connect();
    let totalDeletedCount = 0;
    let cursor = '0';

    do {
      const { cursor: nextCursor, keys } = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });

      cursor = nextCursor;

      if (keys.length > 0) {
        const deletedCount = await client.del(keys); // <-- fix here
        totalDeletedCount += deletedCount;
      }
    } while (cursor !== '0');

    if (totalDeletedCount > 0) {
      logger.info(`[Redis] Deleted ${totalDeletedCount} keys matching pattern: ${pattern}`);
    } else {
      logger.info(`[Redis] No keys found for pattern: ${pattern}`);
    }

    return totalDeletedCount;
  }
};
