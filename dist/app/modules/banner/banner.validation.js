"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBannerValidation = exports.createBannerValidation = void 0;
const zod_1 = require("zod");
const banner_interface_1 = require("./banner.interface");
exports.createBannerValidation = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    image: zod_1.z.url('Image URL must be a valid URL').optional(),
    targetUrl: zod_1.z.string().optional(),
    type: zod_1.z.enum(banner_interface_1.BannerType).optional(),
    targetId: zod_1.z.string().optional(),
    isDeleted: zod_1.z.coerce.boolean().optional().default(false),
    order: zod_1.z.coerce.number().optional().default(0),
});
exports.updateBannerValidation = exports.createBannerValidation.partial();
//# sourceMappingURL=banner.validation.js.map