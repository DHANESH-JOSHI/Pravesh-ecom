import { createClient } from 'redis';
import config from './index';
import { logger } from './logger';

const client = createClient({ url: config.REDIS_URL });

client.on('connect', () => logger.info('[Redis] Connecting...'));
client.on('ready', () => logger.info('[Redis] Connected successfully.'));
client.on('error', (err) => logger.error(`[Redis] Connection error: ${err?.message || err}`));
client.on('end', () => logger.info('[Redis] Connection closed.'));

import { CacheTTL } from '../utils/cacheTTL';
const DEFAULT_TTL = CacheTTL.MEDIUM;

export const redis = {
  async connect() {
    if (!client.isOpen) await client.connect();
  },
  async quit() {
    if (client.isOpen)
      await client.quit();
  },
  async get<T>(key: string): Promise<T | null> {
    await this.connect();
    const data = await client.get(key);
    if (!data) {
      logger.info(`[Redis] CACHE MISS for key: ${key}`);
      return null;
    }
    logger.info(`[Redis] CACHE HIT for key: ${key}`);
    try {
      return JSON.parse(data) as T;
    } catch (err: any) {
      logger.error(`[Redis] JSON parse error for key: ${key}: ${err?.message || err}`);
      return null;
    }
  },

  async set<T>(key: string, value: T, ttl: number = DEFAULT_TTL): Promise<boolean> {
    await this.connect();
    const result = await client.set(key, JSON.stringify(value), { EX: ttl });
    return result === 'OK';
  },

  async setJson(key: string, value: unknown, ttl: number = DEFAULT_TTL): Promise<boolean> {
    return this.set(key, value, ttl);
  },

  async getJson<T>(key: string): Promise<T | null> {
    return this.get<T>(key);
  },

  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached as T;
    const fresh = await fetcher();
    await this.set(key, fresh, ttl);
    return fresh;
  },

  async delete(key: string): Promise<boolean> {
    await this.connect();
    const result = await client.del(key);
    return result > 0;
  },

  async deleteByPattern(pattern: string): Promise<void> {
    await this.connect();
    let cursor = '0';
    let totalDeleted = 0;
    do {
      const { cursor: nextCursor, keys } = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 500,
      });
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = client.multi();
        for (const k of keys) {
          pipeline.del(k);
        }
        const results = await pipeline.exec();
        const deletedCount = results?.reduce((acc, r) => acc + (typeof r === 'number' ? r : 0), 0) ?? 0;
        totalDeleted += deletedCount;
        logger.info(`[Redis] Deleted ${deletedCount} keys for pattern "${pattern}" batch. Keys: ${keys.join(', ')}`);
      }
    } while (cursor !== '0');

    logger.info(`[Redis] Total keys deleted for pattern "${pattern}": ${totalDeleted}`);
  },

  async flushAll(): Promise<void> {
    await this.connect();
    await client.flushAll();
  }
};
