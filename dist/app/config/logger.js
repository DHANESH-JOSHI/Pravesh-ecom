"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = require("winston");
const { combine, timestamp, printf, colorize } = winston_1.format;
require("winston-mongodb");
const _1 = __importDefault(require("."));
const isProd = _1.default.NODE_ENV === 'production';
const logger = (0, winston_1.createLogger)({
    level: isProd ? 'info' : 'debug',
    format: combine(...(!isProd ? [colorize()] : []), timestamp({ format: isProd ? 'YYYY-MM-DD HH:mm:ss' : 'HH:mm:ss' }), printf(({ level, message, timestamp }) => {
        return `[${level}] : ${timestamp} :: ${message}`;
    })),
    transports: [
        new winston_1.transports.Console({}),
        ...(isProd
            ? [new winston_1.transports.MongoDB({
                    db: _1.default.DATABASE_URL,
                    level: 'info',
                })]
            : [])
    ],
});
exports.logger = logger;
//# sourceMappingURL=logger.js.map