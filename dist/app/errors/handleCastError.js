"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCastError = void 0;
const interface_1 = require("../interface");
const http_status_1 = __importDefault(require("http-status"));
const handleCastError = (err) => {
    const message = `Invalid ${err.path}: ${err.value}.`;
    return new interface_1.ApiError(http_status_1.default.BAD_REQUEST, message);
};
exports.handleCastError = handleCastError;
//# sourceMappingURL=handleCastError.js.map