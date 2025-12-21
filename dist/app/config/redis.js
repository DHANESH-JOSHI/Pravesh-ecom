"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const redis_1 = require("redis");
const index_1 = __importDefault(require("./index"));
const logger_1 = require("./logger");
const client = (0, redis_1.createClient)({ url: index_1.default.REDIS_URL });
client.on('connect', () => logger_1.logger.info('[Redis] Connecting...'));
client.on('ready', () => logger_1.logger.info('[Redis] Connected successfully.'));
client.on('error', (err) => logger_1.logger.error(`[Redis] Connection error: ${err?.message || err}`));
client.on('end', () => logger_1.logger.info('[Redis] Connection closed.'));
const cacheTTL_1 = require("../utils/cacheTTL");
const DEFAULT_TTL = cacheTTL_1.CacheTTL.MEDIUM;
exports.redis = {
    async connect() {
        if (!client.isOpen)
            await client.connect();
    },
    async quit() {
        if (client.isOpen)
            await client.quit();
    },
    async get(key) {
        await this.connect();
        const data = await client.get(key);
        if (!data) {
            logger_1.logger.info(`[Redis] CACHE MISS for key: ${key}`);
            return null;
        }
        logger_1.logger.info(`[Redis] CACHE HIT for key: ${key}`);
        try {
            return JSON.parse(data);
        }
        catch (err) {
            logger_1.logger.error(`[Redis] JSON parse error for key: ${key}: ${err?.message || err}`);
            return null;
        }
    },
    async set(key, value, ttl = DEFAULT_TTL) {
        await this.connect();
        const result = await client.set(key, JSON.stringify(value), { EX: ttl });
        return result === 'OK';
    },
    async setJson(key, value, ttl = DEFAULT_TTL) {
        return this.set(key, value, ttl);
    },
    async getJson(key) {
        return this.get(key);
    },
    async getOrSet(key, fetcher, ttl = DEFAULT_TTL) {
        const cached = await this.get(key);
        if (cached !== null)
            return cached;
        const fresh = await fetcher();
        await this.set(key, fresh, ttl);
        return fresh;
    },
    async delete(key) {
        await this.connect();
        const result = await client.del(key);
        return result > 0;
    },
    async deleteByPattern(pattern) {
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
                logger_1.logger.info(`[Redis] Deleted ${deletedCount} keys for pattern "${pattern}" batch. Keys: ${keys.join(', ')}`);
            }
        } while (cursor !== '0');
        logger_1.logger.info(`[Redis] Total keys deleted for pattern "${pattern}": ${totalDeleted}`);
    },
    async flushAll() {
        await this.connect();
        await client.flushAll();
    }
};
//# sourceMappingURL=redis.js.map