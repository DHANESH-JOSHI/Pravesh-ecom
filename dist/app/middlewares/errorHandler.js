"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errors_1 = require("../errors");
const interface_1 = require("../interface");
const zod_1 = require("zod");
const http_status_1 = __importDefault(require("http-status"));
const errorHandler = (err, req, res, next) => {
    if (err.name === 'CastError')
        err = (0, errors_1.handleCastError)(err);
    if (err.code === 11000)
        err = (0, errors_1.handleDuplicateError)(err);
    if (err instanceof zod_1.ZodError)
        err = (0, errors_1.handleZodError)(err);
    res.status(err.statusCode || http_status_1.default.INTERNAL_SERVER_ERROR).json(new interface_1.ApiResponse(err.statusCode || http_status_1.default.INTERNAL_SERVER_ERROR, err.message || 'Internal Server Error', undefined, err.context));
    return;
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map