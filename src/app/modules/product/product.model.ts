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
      type: [String],
      default: [],
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

    totalSold: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret: any) {
        if (ret.createdAt && typeof ret.createdAt !== 'string') {
          ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
        if (ret.updatedAt && typeof ret.updatedAt !== 'string') {
          ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
        return ret;
      }
    },
  }
);

ProductSchema.index({ name: 'text', description: 'text', tags: 'text', shortDescription: 'text' });
ProductSchema.index({ slug: 1, isDeleted: 1 });
ProductSchema.index({ sku: 1, isDeleted: 1 });
ProductSchema.index({ status: 1, isDeleted: 1, isFeatured: 1, createdAt: -1 });
ProductSchema.index({ status: 1, isDeleted: 1, isNewArrival: 1, createdAt: -1 });
ProductSchema.index({ status: 1, isDeleted: 1, isDiscount: 1, discountValue: -1 });
ProductSchema.index({ status: 1, isDeleted: 1, category: 1, finalPrice: 1 });
ProductSchema.index({ status: 1, isDeleted: 1, brand: 1, finalPrice: 1 });
ProductSchema.index({ finalPrice: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ rating: -1 });
ProductSchema.index({ totalSold: -1 });
ProductSchema.index({ salesCount: -1 });

const calculateFinalPrice = (doc: IProduct) => {
  if (doc.discountValue > 0) {
    if (doc.discountType === DiscountType.Percentage) {
      doc.finalPrice = doc.originalPrice - (doc.originalPrice * doc.discountValue / 100);
    } else {
      doc.finalPrice = doc.originalPrice - doc.discountValue;
    }
  } else {
    doc.finalPrice = doc.originalPrice;
  }
};

ProductSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;
  if (update.$set.originalPrice || update.$set.discountValue || update.$set.discountType) {
    this.model.findOne(this.getQuery()).then(doc => {
      const newDoc = { ...doc.toObject(), ...update.$set };
      calculateFinalPrice(newDoc);
      update.$set.finalPrice = newDoc.finalPrice;
      next();
    });
  } else {
    next();
  }
});

ProductSchema.pre('save', function (next) {
  calculateFinalPrice(this);
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
