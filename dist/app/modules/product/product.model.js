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
exports.Product = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const mongooseToJSON_1 = __importDefault(require("../../utils/mongooseToJSON"));
const slugify_1 = require("../../utils/slugify");
const skuify_1 = require("../../utils/skuify");
const productSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, unique: true, trim: true },
    sku: { type: String, unique: true, trim: true },
    // description: { type: String },
    // shortDescription: { type: String },
    brand: { type: mongoose_1.Schema.Types.ObjectId, ref: "Brand" },
    category: { type: mongoose_1.Schema.Types.ObjectId, ref: "Category", required: true },
    originalPrice: { type: Number, required: true },
    // discountValue: { type: Number, default: 0 },
    // discountType: { type: String, enum: DiscountType, default: DiscountType.Percentage },
    // finalPrice: { type: Number, default: 0 },
    // stock: { type: Number, required: true },
    // minStock: { type: Number, default: 0 },
    unit: {
        type: String,
        required: true,
    },
    // stockStatus: {
    //   type: String,
    //   enum: StockStatus,
    // },
    // features: {
    //   type: [String],
    //   default: [],
    // },
    specifications: {
        type: Object,
        default: {},
    },
    // images: [{ type: String, required: true }],
    thumbnail: { type: String },
    tags: [{ type: String, trim: true }],
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    // isDiscount: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    totalSold: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
}, {
    timestamps: true,
});
(0, mongooseToJSON_1.default)(productSchema);
productSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'product',
    justOne: false,
});
productSchema.index({ slug: 1, isDeleted: 1 });
productSchema.index({ sku: 1, isDeleted: 1 });
productSchema.index({ isDeleted: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ isDeleted: 1, isNewArrival: 1, createdAt: -1 });
// productSchema.index({ isDeleted: 1, isDiscount: 1, discountValue: -1 });
productSchema.index({ isDeleted: 1, category: 1, originalPrice: 1 });
productSchema.index({ isDeleted: 1, brand: 1, originalPrice: 1 });
productSchema.index({ originalPrice: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ rating: -1 });
productSchema.index({ totalSold: -1 });
productSchema.index({ salesCount: -1 });
// const calculateFinalPrice = (doc: IProduct) => {
//   if (doc.discountValue > 0) {
//     if (doc.discountType === DiscountType.Percentage) {
//       doc.finalPrice = doc.originalPrice - (doc.originalPrice * doc.discountValue / 100);
//     } else {
//       doc.finalPrice = doc.originalPrice - doc.discountValue;
//     }
//   } else {
//     doc.finalPrice = doc.originalPrice;
//   }
// };
// productSchema.pre("findOneAndUpdate", function (next) {
//   const update = this.getUpdate() as any;
//   // If no $set provided, nothing to do here
//   if (!update || !update.$set) {
//     return next();
//   }
//   // only handle finalPrice recalculation on updates (do not auto-generate slug/sku here)
//   const needPriceUpdate = update.$set.originalPrice || update.$set.discountValue || update.$set.discountType;
//   if (!needPriceUpdate) {
//     return next();
//   }
//   // load existing document to compute derived fields
//   this.model
//     .findOne(this.getQuery())
//     .then((doc: any) => {
//       if (!doc) {
//         return next();
//       }
//       const newDoc = { ...doc.toObject(), ...update.$set } as IProduct;
//       calculateFinalPrice(newDoc);
//       update.$set.finalPrice = newDoc.finalPrice;
//       next();
//     })
//     .catch(next);
// });
productSchema.pre("validate", async function (next) {
    if (!this.slug && this.name) {
        this.slug = await (0, slugify_1.generateUniqueSlug)(this.name);
    }
    if (!this.sku && this.name) {
        this.sku = await (0, skuify_1.generateUniqueSKU)();
    }
    next();
});
productSchema.pre("save", function (next) {
    // // ensure finalPrice and stockStatus
    // calculateFinalPrice(this);
    // if (this.stock === 0) {
    //   this.stockStatus = StockStatus.OutOfStock;
    // } else if (this.stock < this.minStock) {
    //   this.stockStatus = StockStatus.LowStock;
    // } else if (this.stock >= this.minStock && this.stockStatus !== StockStatus.InStock) {
    //   this.stockStatus = StockStatus.InStock;
    // }
    next();
});
productSchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();
    const query = this.getQuery();
    if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
        const productId = query._id;
        const Review = mongoose_1.default.model("Review");
        const Cart = mongoose_1.default.model("Cart");
        const Wishlist = mongoose_1.default.model("Wishlist");
        const product = await exports.Product.findOne({ _id: productId, isDeleted: false });
        if (product) {
            await Promise.all([
                Review.deleteMany({ product: productId }),
                Cart.updateMany({ "items.product": productId }, { $pull: { items: { product: productId } } }),
                Wishlist.updateMany({ items: productId }, { $pull: { items: productId } })
            ]);
        }
    }
    next();
});
exports.Product = mongoose_1.default.models.Product || mongoose_1.default.model('Product', productSchema);
//# sourceMappingURL=product.model.js.map