"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCartItemValidation = exports.addToCartValidation = void 0;
const zod_1 = require("zod");
const mongoose_1 = require("mongoose");
const objectIdValidation = zod_1.z
    .string()
    .refine((val) => mongoose_1.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
}).transform((val) => new mongoose_1.Types.ObjectId(val));
const addToCartValidation = zod_1.z.object({
    productId: objectIdValidation,
    quantity: zod_1.z.coerce.number().int().positive('Quantity must be a positive integer'),
});
exports.addToCartValidation = addToCartValidation;
const updateCartItemValidation = zod_1.z.object({
    quantity: zod_1.z.coerce.number().int().min(0, 'Quantity must be a non-negative integer'),
});
exports.updateCartItemValidation = updateCartItemValidation;
//# sourceMappingURL=cart.validation.js.map