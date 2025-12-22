"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataCheckLimiter = exports.authenticatedActionLimiter = exports.smsLimiter = exports.emailLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const interface_1 = require("../interface");
const http_status_1 = __importDefault(require("http-status"));
const createRateLimiter = (options) => {
    return (0, express_rate_limit_1.default)({
        ...options,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res, next) => {
            next(new interface_1.ApiError(http_status_1.default.TOO_MANY_REQUESTS, options.message, "RATE_LIMIT"));
        },
    });
};
exports.apiLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 150,
    message: "Too many requests from this IP, please try again later.",
});
exports.authLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 20,
    message: "Too many authentication attempts from this IP. Please try again later.",
});
exports.emailLimiter = createRateLimiter({
    windowMs: 30 * 60 * 1000,
    max: 7,
    message: "Too many email requests from this IP. Please try again later.",
});
exports.smsLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 7,
    message: "Too many SMS requests from this IP. Please try again later.",
});
exports.authenticatedActionLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 100,
    message: "You are performing this action too frequently. Please try again later.",
    keyGenerator: (req) => {
        if (req.user?.id) {
            return req.user.id.toString();
        }
        return (0, express_rate_limit_1.ipKeyGenerator)(req.ip);
    },
});
exports.dataCheckLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 25,
    message: "Too many data lookup requests from this IP. Please try again later.",
});
//# sourceMappingURL=rateLimiter.js.map