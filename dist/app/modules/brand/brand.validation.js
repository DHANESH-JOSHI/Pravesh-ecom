"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandUpdateValidation = exports.brandValidation = void 0;
const zod_1 = require("zod");
exports.brandValidation = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name must be at least 2 characters long"),
    categoryIds: zod_1.z.preprocess((val) => {
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            }
            catch (e) {
                return val;
            }
        }
        return val;
    }, zod_1.z.array(zod_1.z.string()).refine(val => typeof val === 'object' && val !== null, {
        message: "CategoryIds must be a valid array.",
    }).optional()),
});
exports.brandUpdateValidation = zod_1.z.object({
    name: zod_1.z.string().min(2, "Name must be at least 2 characters long").optional(),
    categoryIds: zod_1.z.preprocess((val) => {
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            }
            catch (e) {
                return val;
            }
        }
        return val;
    }, zod_1.z.array(zod_1.z.string()).refine(val => typeof val === 'object' && val !== null, {
        message: "CategoryIds must be a valid array.",
    }).optional()),
});
//# sourceMappingURL=brand.validation.js.map