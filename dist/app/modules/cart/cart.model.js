"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cart = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const mongooseToJSON_1 = __importDefault(require("../../utils/mongooseToJSON"));
const cartItemSchema = new mongoose_1.Schema({
    product: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    }
});
const cartSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    items: [cartItemSchema],
}, {
    timestamps: true,
});
(0, mongooseToJSON_1.default)(cartSchema);
cartSchema.methods.addItem = async function (productId, quantity) {
    const existingItemIndex = this.items.findIndex((item) => item.product.equals(productId));
    if (existingItemIndex > -1) {
        this.items[existingItemIndex].quantity += quantity;
    }
    else {
        this.items.push({ product: productId, quantity });
    }
    return this.save();
};
cartSchema.methods.updateItem = async function (productId, quantity) {
    const itemIndex = this.items.findIndex((item) => item.product.equals(productId));
    if (itemIndex === -1) {
        throw new Error('Item not found in cart');
    }
    if (quantity <= 0) {
        this.items.splice(itemIndex, 1);
    }
    else {
        this.items[itemIndex].quantity = quantity;
    }
    return this.save();
};
cartSchema.methods.removeItem = async function (productId) {
    this.items = this.items.filter((item) => !(item.product.equals(productId)));
    return this.save();
};
cartSchema.methods.clearCart = async function () {
    this.items = [];
    return this.save();
};
cartSchema.methods.getCartSummary = async function () {
    const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
    const populatedProduct = await this.populate('items.product', 'originalPrice');
    const totalPrice = populatedProduct.items.reduce((sum, item) => {
        const product = item.product;
        return sum + (item.quantity * product.originalPrice);
    }, 0);
    return { totalItems, totalPrice };
};
exports.Cart = mongoose_1.default.model('Cart', cartSchema);
//# sourceMappingURL=cart.model.js.map