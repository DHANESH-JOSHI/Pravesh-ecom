"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = require("../modules/user/user.model");
const config_1 = __importDefault(require("../config"));
const interface_1 = require("../interface");
const http_status_1 = __importDefault(require("http-status"));
const redis_1 = require("../config/redis");
const auth = (...requiredRoles) => {
    return async (req, res, next) => {
        try {
            const token = req.cookies?.accessToken || req.headers?.authorization?.replace('Bearer ', '');
            if (!token) {
                return next(new interface_1.ApiError(http_status_1.default.UNAUTHORIZED, "Authentication required. No token provided", "AUTH_MIDDLEWARE"));
            }
            const decoded = jsonwebtoken_1.default.verify(token, config_1.default.JWT_SECRET);
            const cacheKey = `user:${decoded.userId}`;
            let user = await redis_1.redis.get(cacheKey);
            if (!user) {
                user = await user_model_1.User.findById(decoded.userId);
            }
            if (!user) {
                return next(new interface_1.ApiError(http_status_1.default.NOT_FOUND, "User not found", "AUTH_MIDDLEWARE"));
            }
            const userObj = user.toJSON ? user.toJSON() : user;
            const { password: _, otp, otpExpires, ...userObject } = userObj;
            req.user = userObject;
            await redis_1.redis.set(cacheKey, userObject, 600);
            if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
                return next(new interface_1.ApiError(http_status_1.default.FORBIDDEN, "You do not have permission to perform this action", "AUTH_MIDDLEWARE"));
            }
            next();
        }
        catch (error) {
            next(new interface_1.ApiError(http_status_1.default.UNAUTHORIZED, "Invalid or expired token", "AUTH_MIDDLEWARE"));
        }
    };
};
exports.auth = auth;
//# sourceMappingURL=authMiddleware.js.map