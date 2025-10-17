import { createClient } from 'redis';
import config from './index';
import { logger } from './logger';

const client = createClient({ url: config.REDIS_URL });

client.on('connect', () => logger.info('[Redis] Connecting...'));
client.on('ready', () => logger.info('[Redis] Connected successfully.'));
client.on('error', () => logger.error('[Redis] Connection error'));
client.on('end', () => logger.warn('[Redis] Connection closed.'));


export const redis = {
  async connect() {
    if (!client.isOpen) await client.connect();
  },

  async get<T>(key: string): Promise<T | null> {
    await this.connect();
    const data = await client.get(key);
    return data ? JSON.parse(data) as T : null;
  },

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    await this.connect();
    const result = await client.set(key, JSON.stringify(value), ttl ? { EX: ttl } : {});
    return result === 'OK';
  },

  async delete(key: string): Promise<boolean> {
    await this.connect();
    const result = await client.del(key);
    return result > 0;
  },

  async deleteByPattern(pattern: string): Promise<void> {
    await this.connect();
    let cursor = '0';
    do {
      const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      if (result.keys.length) {
        const pipeline = client.multi();
        result.keys.forEach((key) => pipeline.del(key));
        await pipeline.exec();
      }
    } while (cursor !== '0');
  },
};
