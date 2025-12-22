"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUpdateOrderValidation = exports.checkoutFromCartValidation = void 0;
const zod_1 = require("zod");
const order_interface_1 = require("./order.interface");
const mongoose_1 = require("mongoose");
const objectIdValidation = zod_1.z
    .string()
    .refine((val) => mongoose_1.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
}).transform((val) => new mongoose_1.Types.ObjectId(val));
exports.checkoutFromCartValidation = zod_1.z.object({
    shippingAddressId: objectIdValidation,
});
exports.adminUpdateOrderValidation = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        product: objectIdValidation,
        quantity: zod_1.z.number().min(1, 'Quantity must be a positive number'),
    })).optional(),
    status: zod_1.z.enum(order_interface_1.OrderStatus).optional(),
    feedback: zod_1.z.string().max(1000, 'Feedback too long').optional(),
});
//# sourceMappingURL=order.validation.js.map