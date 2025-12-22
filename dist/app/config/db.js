"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const index_1 = __importDefault(require("./index"));
const logger_1 = require("./logger");
let isConnected = false;
const connectDB = async () => {
    if (isConnected) {
        logger_1.logger.info('[DB] Using existing database connection');
        return;
    }
    try {
        await mongoose_1.default.connect(index_1.default.DATABASE_URL);
        isConnected = true;
        logger_1.logger.info('[DB] Database connected successfully');
    }
    catch (error) {
        logger_1.logger.error('[DB] Database connection error:', error);
        throw error;
    }
};
exports.connectDB = connectDB;
//# sourceMappingURL=db.js.map