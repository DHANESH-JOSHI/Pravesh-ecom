"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Review = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongooseToJSON_1 = __importDefault(require("../../utils/mongooseToJSON"));
const reviewSchema = new mongoose_1.default.Schema({
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    product: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
    }
}, {
    timestamps: true,
});
(0, mongooseToJSON_1.default)(reviewSchema);
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ createdAt: -1 });
exports.Review = mongoose_1.default.models.Review || mongoose_1.default.model('Review', reviewSchema);
//# sourceMappingURL=review.model.js.map