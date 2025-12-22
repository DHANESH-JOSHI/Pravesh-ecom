"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryUpdateValidation = exports.categoryValidation = exports.objectIdValidation = void 0;
const zod_1 = require("zod");
const mongoose_1 = require("mongoose");
exports.objectIdValidation = zod_1.z
    .string()
    .refine((val) => val && mongoose_1.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
}).transform((val) => new mongoose_1.Types.ObjectId(val));
exports.categoryValidation = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    parentCategoryId: exports.objectIdValidation.optional(),
});
exports.categoryUpdateValidation = zod_1.z.object({
    title: zod_1.z.string().optional(),
    parentCategoryId: exports.objectIdValidation.optional(),
});
//# sourceMappingURL=category.validation.js.map