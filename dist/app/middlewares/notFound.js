"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = void 0;
const interface_1 = require("../interface");
const http_status_1 = __importDefault(require("http-status"));
const notFound = (req, res, next) => {
    const err = new interface_1.ApiError(http_status_1.default.NOT_FOUND, 'Route Not Found');
    next(err);
};
exports.notFound = notFound;
//# sourceMappingURL=notFound.js.map