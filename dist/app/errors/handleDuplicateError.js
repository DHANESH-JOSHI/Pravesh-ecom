"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDuplicateError = void 0;
const interface_1 = require("../interface");
const http_status_1 = __importDefault(require("http-status"));
const handleDuplicateError = (err) => {
    const match = err.message.match(/"([^"]*)"/);
    const extractedMessage = match && match[1];
    const message = `${extractedMessage} is already exists`;
    const statusCode = http_status_1.default.BAD_REQUEST;
    return new interface_1.ApiError(statusCode, message);
};
exports.handleDuplicateError = handleDuplicateError;
//# sourceMappingURL=handleDuplicateError.js.map