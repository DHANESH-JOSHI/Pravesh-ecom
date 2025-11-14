"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOtpValidation = exports.requestOtpValidation = exports.loginValidation = exports.registerValidation = exports.phoneOrEmailSchema = void 0;
const zod_1 = __importDefault(require("zod"));
const utils_1 = require("../../utils");
exports.phoneOrEmailSchema = zod_1.default
    .string()
    .trim()
    .refine((val) => zod_1.default.email().safeParse(val).success || (0, utils_1.validateIndianMobile)(val), {
    message: "Must be a valid Indian mobile number or a valid email address",
});
exports.registerValidation = zod_1.default.object({
    name: zod_1.default.string(),
    password: zod_1.default.string().min(6),
    phone: zod_1.default.string().refine(utils_1.validateIndianMobile, {
        message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
    }),
    email: zod_1.default.email("Invalid email format").optional(),
});
exports.loginValidation = zod_1.default.object({
    phoneOrEmail: exports.phoneOrEmailSchema,
    password: zod_1.default.string()
});
exports.requestOtpValidation = zod_1.default.object({
    phoneOrEmail: exports.phoneOrEmailSchema,
});
exports.verifyOtpValidation = zod_1.default.object({
    phoneOrEmail: exports.phoneOrEmailSchema,
    otp: zod_1.default
        .string()
        .trim()
        .length(6, "OTP must be exactly 6 digits")
        .regex(/^\d+$/, "OTP must contain only numbers"),
});
//# sourceMappingURL=auth.validation.js.map