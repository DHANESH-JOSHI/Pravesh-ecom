"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiErrorClass = exports.ApiError = void 0;
class ApiError extends Error {
    statusCode;
    message;
    context;
    constructor(status, message = "", context = "Global") {
        super(message);
        this.statusCode = status;
        this.message = message;
        this.context = context;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
const getApiErrorClass = function (context) {
    return class extends ApiError {
        constructor(status, message = "") {
            super(status, message, context);
        }
    };
};
exports.getApiErrorClass = getApiErrorClass;
//# sourceMappingURL=apiError.js.map