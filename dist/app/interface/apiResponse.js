"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiResponseClass = exports.ApiResponse = void 0;
const logger_1 = require("../config/logger");
const http_status_1 = __importDefault(require("http-status"));
class ApiResponse {
    statusCode;
    success;
    message;
    data;
    constructor(statusCode, message, data, context = 'Global') {
        logger_1.logger.info(`[${context}] : ${message}`);
        this.statusCode = statusCode;
        this.success = statusCode === http_status_1.default.OK || statusCode === http_status_1.default.CREATED || statusCode === http_status_1.default.ACCEPTED || statusCode === http_status_1.default.NO_CONTENT;
        this.message = message;
        this.data = data;
    }
}
exports.ApiResponse = ApiResponse;
const getApiResponseClass = function (context) {
    return class extends ApiResponse {
        constructor(statusCode, message, data) {
            super(statusCode, message, data, context);
        }
    };
};
exports.getApiResponseClass = getApiResponseClass;
//# sourceMappingURL=apiResponse.js.map