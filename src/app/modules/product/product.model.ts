import mongoose, { Schema } from "mongoose";
import { DiscountType, IProduct, ProductStatus, StockStatus, UnitType } from "./product.interface";

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, unique: true, trim: true, sparse: true },
    sku: { type: String, unique: true, sparse: true, trim: true },
    description: { type: String },
    shortDescription: { type: String },

    brand: { type: Schema.Types.ObjectId, ref: "Brand" },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },

    originalPrice: { type: Number, required: true },
    discountValue: { type: Number, default: 0 },
    discountType: { type: String, enum: DiscountType, default: DiscountType.Percentage },
    finalPrice: { type: Number, default: 0 },
    stock: { type: Number, required: true },
    minStock: { type: Number, default: 5 },
    unit: {
      type: String,
      enum: UnitType,
      required: true,
    },
    stockStatus: {
      type: String,
      enum: StockStatus,
      default: StockStatus.InStock,
    },

    features: {
      type: Map,
      of: [String],
      default: {},
    },
    specifications: {
      type: Map,
      of: [String],
      default: {},
    },

    images: [{ type: String, required: true }],
    thumbnail: { type: String, required: true },

    status: { type: String, enum: ProductStatus, default: ProductStatus.Active },
    tags: [{ type: String, trim: true }],
    seoTitle: { type: String, trim: true },
    seoDescription: { type: String, trim: true },
    seoKeywords: [{ type: String, trim: true }],

    shippingInfo: {
      type: Map,
      of: [String],
      default: {},
    },


    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isDiscount: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },

    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret: any) {
        ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      }
    },
  }
);

// Indexes for better query performance
ProductSchema.index({ name: 'text', description: 'text', tags: 'text', shortDescription: 'text' });
ProductSchema.index({ finalPrice: 1, category: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ rating: -1, reviewCount: -1 });

// Pre-save middleware to update final price based on discount
ProductSchema.pre('save', function (next) {
  if (this.discountValue > 0) {
    if (this.discountType === 'percentage') {
      this.finalPrice = this.originalPrice - (this.originalPrice * this.discountValue / 100);
    } else {
      this.finalPrice = this.originalPrice - this.discountValue;
    }
  }
  next();
});

// Pre-save middleware to update status based on stock
ProductSchema.pre('save', function (next) {
  if (this.stock === 0) {
    this.status = ProductStatus.Inactive;
    this.stockStatus = StockStatus.OutOfStock;
  }
  if (this.stock < this.minStock) {
    this.stockStatus = StockStatus.LowStock;
    this.status = ProductStatus.Active;
  } else if (this.stock >= this.minStock && this.stockStatus !== StockStatus.InStock) {
    this.stockStatus = StockStatus.InStock;
    this.status = ProductStatus.Active;
  }
  next();
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
