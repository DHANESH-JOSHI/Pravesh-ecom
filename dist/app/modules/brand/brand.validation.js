"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandUpdateValidation = exports.brandValidation = void 0;
const zod_1 = require("zod");
const category_validation_1 = require("../category/category.validation");
exports.brandValidation = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name must be at least 2 characters long"),
    categoryIds: category_validation_1.objectIdValidation.array().optional()
});
exports.brandUpdateValidation = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name must be at least 2 characters long").optional(),
    categoryIds: category_validation_1.objectIdValidation.array().optional()
});
//# sourceMappingURL=brand.validation.js.map