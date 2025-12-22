"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addFundsValidation = void 0;
const zod_1 = require("zod");
const mongoose_1 = require("mongoose");
const objectIdValidation = zod_1.z
    .string()
    .refine((val) => mongoose_1.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
}).transform((val) => new mongoose_1.Types.ObjectId(val));
exports.addFundsValidation = zod_1.z.object({
    userId: objectIdValidation,
    amount: zod_1.z.coerce.number().positive("Amount must be a positive number"),
    description: zod_1.z.string().optional(),
});
//# sourceMappingURL=wallet.validation.js.map