"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateTokens = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config"));
const generateToken = (payload, expiresIn) => {
    return jsonwebtoken_1.default.sign(payload, config_1.default.JWT_SECRET, { expiresIn: expiresIn });
};
const generateTokens = (user) => {
    const payload = {
        userId: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role
    };
    const accessToken = generateToken(payload, '15m');
    const refreshToken = generateToken(payload, '7d');
    return { accessToken, refreshToken };
};
exports.generateTokens = generateTokens;
const verifyToken = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.JWT_SECRET);
        return decoded;
    }
    catch (error) {
        return false;
    }
};
exports.verifyToken = verifyToken;
//# sourceMappingURL=generateToken.js.map