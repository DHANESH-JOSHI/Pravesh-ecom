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
client.on('error', () => logger_1.logger.error('[Redis] Connection error'));
client.on('end', () => logger_1.logger.info('[Redis] Connection closed.'));
const CACHE_TTL = 900;
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
        if (data) {
            logger_1.logger.info(`[Redis] CACHE HIT for key: ${key}`);
            return JSON.parse(data);
        }
        else {
            logger_1.logger.info(`[Redis] CACHE MISS for key: ${key}`);
            return null;
        }
    },
    async set(key, value, ttl = CACHE_TTL) {
        await this.connect();
        const result = await client.set(key, JSON.stringify(value), { EX: ttl });
        return result === 'OK';
    },
    async delete(key) {
        await this.connect();
        const result = await client.del(key);
        return result > 0;
    },
    async deleteByPattern(pattern) {
        await this.connect();
        let cursor = '0';
        do {
            const { cursor: nextCursor, keys } = await client.scan(cursor, {
                MATCH: pattern,
                COUNT: 100,
            });
            cursor = nextCursor;
            if (keys.length > 0) {
                await client.del(keys);
                logger_1.logger.info(`[Redis] Deleting keys: ${keys.join(', ')}`);
            }
        } while (cursor !== '0');
    },
    async flushAll() {
        await this.connect();
        await client.flushAll();
    }
};
//# sourceMappingURL=redis.js.map