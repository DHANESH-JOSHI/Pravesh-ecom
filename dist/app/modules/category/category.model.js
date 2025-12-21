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
exports.Category = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const mongooseToJSON_1 = __importDefault(require("../../utils/mongooseToJSON"));
const slugify_1 = require("../../utils/slugify");
const pixabay_1 = require("../../utils/pixabay");
const categorySchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: { type: String, required: true, unique: true, lowercase: true },
    image: {
        type: String,
    },
    brands: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Brand',
        }
    ],
    isDeleted: {
        type: Boolean,
        default: false
    },
    parentCategory: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    path: [
        {
            type: String
        }
    ]
}, {
    timestamps: true,
});
(0, mongooseToJSON_1.default)(categorySchema);
categorySchema.virtual('children', {
    ref: 'Category',
    localField: '_id',
    foreignField: 'parentCategory',
    justOne: false,
    match: { isDeleted: false }
});
categorySchema.virtual('products', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'category',
    justOne: false,
    match: { isDeleted: false }
});
categorySchema.index({ createdAt: -1 });
categorySchema.index({ parentCategory: -1 });
categorySchema.index({ isDeleted: -1 });
categorySchema.index({ parentCategory: 1, title: 1 }, {
    unique: true,
    partialFilterExpression: { isDeleted: false }
});
categorySchema.pre("validate", async function (next) {
    if (!this.slug && this.title) {
        this.slug = await (0, slugify_1.generateUniqueSlug)(this.title);
    }
    next();
});
categorySchema.pre("save", async function (next) {
    // Build hierarchical path first
    if (this.parentCategory) {
        const parent = await mongoose_1.default.model("Category").findById(this.parentCategory);
        if (parent) {
            this.path = [...parent.path, this.slug];
        }
    }
    else {
        this.path = [this.slug];
    }
    try {
        if (!this.image && this.title && Array.isArray(this.path)) {
            const pixabayUrl = await (0, pixabay_1.getPixabayImageForCategory)(this.title, Array.isArray(this.path) ? this.path : []);
            if (pixabayUrl) {
                this.image = pixabayUrl;
            }
        }
    }
    catch (err) {
        console.error('[CATEGORY_IMAGE] Generation failed:', err?.message || err);
    }
    next();
});
categorySchema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();
    const query = this.getQuery();
    if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
        const categoryId = query._id;
        const Category = mongoose_1.default.model("Category");
        const Product = mongoose_1.default.model("Product");
        const Brand = mongoose_1.default.model("Brand");
        const category = await Category.findOne({ _id: categoryId, isDeleted: false });
        if (category) {
            await Promise.all([
                Category.updateMany({ parentCategory: categoryId, isDeleted: false }, { $set: { isDeleted: true } }),
                Product.updateMany({ category: categoryId, isDeleted: false }, { $unset: { category: "" } }),
                Brand.updateMany({ categories: categoryId, isDeleted: false }, { $pull: { categories: categoryId } })
            ]);
        }
    }
    next();
});
exports.Category = mongoose_1.default.models.Category || mongoose_1.default.model('Category', categorySchema);
//# sourceMappingURL=category.model.js.map