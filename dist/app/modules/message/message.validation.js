"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMessageValidation = void 0;
const zod_1 = require("zod");
exports.createMessageValidation = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required").max(200),
    email: zod_1.z.string().email("Invalid email"),
    subject: zod_1.z.string().max(300).optional(),
    message: zod_1.z.string().min(1, "Message is required").max(5000),
});
//# sourceMappingURL=message.validation.js.map