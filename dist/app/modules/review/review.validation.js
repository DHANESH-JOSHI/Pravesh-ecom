"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewValidation = void 0;
const zod_1 = __importDefault(require("zod"));
exports.reviewValidation = zod_1.default.object({
    rating: zod_1.default.coerce.number().min(1).max(5, "Rating must be between 1 and 5"),
    comment: zod_1.default.string().optional(),
    productId: zod_1.default.string(),
});
//# sourceMappingURL=review.validation.js.map