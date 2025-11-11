"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addOrRemoveProductValidation = void 0;
const zod_1 = require("zod");
const mongoose_1 = require("mongoose");
const objectIdValidation = zod_1.z
    .string()
    .refine((val) => mongoose_1.Types.ObjectId.isValid(val), {
    message: 'Invalid product ObjectId',
});
exports.addOrRemoveProductValidation = zod_1.z.object({
    productId: objectIdValidation,
});
//# sourceMappingURL=wishlist.validation.js.map