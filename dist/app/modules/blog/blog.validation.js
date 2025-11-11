"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBlogValidation = exports.createBlogValidation = void 0;
const zod_1 = require("zod");
exports.createBlogValidation = zod_1.z.object({
    title: zod_1.z.string().min(3, 'Title must be at least 3 characters long'),
    content: zod_1.z.string().min(10, 'Content is required'),
    tags: zod_1.z.preprocess((val) => {
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            }
            catch (e) {
                return val;
            }
        }
        return val;
    }, zod_1.z.array(zod_1.z.string()).optional()),
    isPublished: zod_1.z.coerce.boolean().optional(),
});
exports.updateBlogValidation = exports.createBlogValidation.partial();
//# sourceMappingURL=blog.validation.js.map