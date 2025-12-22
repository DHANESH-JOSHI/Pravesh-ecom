"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Brand = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongooseToJSON_1 = __importDefault(require("../../utils/mongooseToJSON"));
const slugify_1 = require("../../utils/slugify");
const brandSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: true
    },
    slug: { type: String, required: true, unique: true, lowercase: true },
    image: {
        type: String,
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    categories: [
        {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Category',
        }
    ]
}, {
    timestamps: true,
});
(0, mongooseToJSON_1.default)(brandSchema);
brandSchema.virtual('products', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'brand',
    justOne: false,
    match: { isDeleted: false }
});
brandSchema.pre("validate", async function (next) {
    if (!this.slug && this.name) {
        this.slug = await (0, slugify_1.generateUniqueSlug)(this.name);
    }
    next();
});
brandSchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();
    const query = this.getQuery();
    if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
        const brandId = query._id;
        const Product = mongoose_1.default.model("Product");
        const Category = mongoose_1.default.model("Category");
        const brand = await exports.Brand.findOne({ _id: brandId, isDeleted: false });
        if (brand) {
            await Promise.all([
                Product.updateMany({ brand: brandId, isDeleted: false }, { $unset: { brand: "" } }),
                Category.updateMany({ brands: brandId, isDeleted: false }, { $pull: { brands: brandId } })
            ]);
        }
    }
    next();
});
brandSchema.index({ createdAt: -1, isDeleted: 1 });
brandSchema.index({ name: 1 }, {
    unique: true,
    partialFilterExpression: { isDeleted: false }
});
exports.Brand = mongoose_1.default.models.Brand || mongoose_1.default.model('Brand', brandSchema);
//# sourceMappingURL=brand.model.js.map