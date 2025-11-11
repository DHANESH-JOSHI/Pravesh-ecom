"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wishlist = void 0;
const mongoose_1 = require("mongoose");
const mongooseToJSON_1 = __importDefault(require("../../utils/mongooseToJSON"));
const WishlistSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    items: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Product',
        },
    ],
}, {
    timestamps: true,
});
(0, mongooseToJSON_1.default)(WishlistSchema);
exports.Wishlist = (0, mongoose_1.model)('Wishlist', WishlistSchema);
//# sourceMappingURL=wishlist.model.js.map