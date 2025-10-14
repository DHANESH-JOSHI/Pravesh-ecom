import mongoose, { Schema } from "mongoose";
import { IProduct, ProductStatus } from "./product.interface";

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, unique: true, trim: true, sparse: true },
    sku: { type: String, unique: true, sparse: true, trim: true },
    description: { type: String },
    shortDescription: { type: String },

    brand: { type: Schema.Types.ObjectId, ref: "Brand" },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },

    pricing: {
      basePrice: { type: Number, required: true },
      discount: {
        value: { type: Number, default: 0 },
        type: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
      }
    },
    inventory: {
      stock: { type: Number, required: true },
      unit: {
        type: String,
        enum: ["bag", "piece", "kg", "ton", "litre", "bundle", "meter"],
        required: true,
      },
      minStock: { type: Number, default: 1 },
    },

    attributes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    specifications: {
      type: Map,
      of: [String],
      default: {},
    },

    images: [{ type: String, required: true }],
    thumbnail: { type: String, required: true },

    tags: [{ type: String, trim: true }],
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    seoKeywords: [{ type: String, trim: true }],

    shippingInfo: {
      weight: { type: Number, default: 0 }, // in kg
      freeShipping: { type: Boolean, default: false },
      shippingCost: { type: Number, default: 0 },
      estimatedDelivery: { type: String, default: "" },
    },

    status: {
      type: String,
      enum: ["active", "inactive", "out_of_stock", "discontinued"],
      default: "active",
    },

    isFeatured: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isDiscount: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },

    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret: any) {
        ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      }
    },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
ProductSchema.index({ name: 'text', description: 'text', tags: 'text', shortDescription: 'text' });
ProductSchema.index({ 'pricing.basePrice': 1, category: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ rating: -1, reviewCount: -1 });

// Virtual for calculating final price after discount
ProductSchema.virtual<IProduct>('finalPrice').get(function () {
  if (this.pricing.discount.value > 0) {
    if (this.pricing.discount.type === 'percentage') {
      return this.pricing.basePrice - (this.pricing.basePrice * this.pricing.discount.value / 100);
    } else {
      return this.pricing.basePrice - this.pricing.discount.value;
    }
  }
  return this.pricing.basePrice;
});

// Virtual for stock status
ProductSchema.virtual<IProduct>('stockStatus').get(function () {
  if (this.inventory.stock === 0) return 'out_of_stock';
  if (this.inventory.stock <= this.inventory.minStock) return 'low_stock';
  else if (this.inventory.stock > 0 && this.status === 'out_of_stock') return 'in_stock';
  return 'in_stock';
});

// Pre-save middleware to update status based on stock
ProductSchema.pre('save', function (next) {
  if (this.inventory.stock === 0 && this.status === 'active') {
    this.status = ProductStatus.OutOfStock;
  } else if (this.inventory.stock > 0 && this.status === ProductStatus.OutOfStock) {
    this.status = ProductStatus.Active;
  }
  next();
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
