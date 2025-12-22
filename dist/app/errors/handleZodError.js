"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleZodError = void 0;
const interface_1 = require("../interface");
const http_status_1 = __importDefault(require("http-status"));
const handleZodError = (err) => {
    const errors = err.issues.map((issue) => `${issue.path.length ? issue.path.join('/') : 'body'} ::${issue.message}`).join(' || ');
    return new interface_1.ApiError(http_status_1.default.BAD_REQUEST, errors);
};
exports.handleZodError = handleZodError;
//# sourceMappingURL=handleZodError.js.map