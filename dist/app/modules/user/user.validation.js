"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserValidation = exports.emailCheckValidation = exports.phoneCheckValidation = exports.updatePasswordValidation = exports.resetPasswordValidation = void 0;
const utils_1 = require("../../utils");
const zod_1 = require("zod");
exports.resetPasswordValidation = zod_1.z.object({
    otp: zod_1.z
        .string()
        .trim()
        .length(6, "OTP must be exactly 6 digits")
        .regex(/^\d+$/, "OTP must contain only numbers"),
    newPassword: zod_1.z.string().min(6)
});
exports.updatePasswordValidation = zod_1.z.object({
    currentPassword: zod_1.z.string().min(6),
    newPassword: zod_1.z.string().min(6)
});
exports.phoneCheckValidation = zod_1.z.object({
    phone: zod_1.z.string().refine(utils_1.validateIndianMobile, {
        message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
    })
});
exports.emailCheckValidation = zod_1.z.object({
    email: zod_1.z.email("Invalid email format")
});
exports.updateUserValidation = zod_1.z.object({
    name: zod_1.z.string().optional(),
    email: zod_1.z.union([
        zod_1.z.email("Invalid email format"),
        zod_1.z.string().length(0)
    ]).optional(),
    img: zod_1.z.string().optional()
});
//# sourceMappingURL=user.validation.js.map