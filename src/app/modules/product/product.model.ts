import mongoose, { Schema } from "mongoose";
import { IProduct } from "./product.interface";
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { generateUniqueSlug } from "@/utils/slugify";
import { generateUniqueSKU } from "@/utils/skuify";

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, unique: true, trim: true },
    sku: { type: String, unique: true, trim: true },
    // description: { type: String },
    // shortDescription: { type: String },

    brand: { type: Schema.Types.ObjectId, ref: "Brand" },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },

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
      type: Map,
      of: String,
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
  },
  {
    timestamps: true,
  }
);

applyMongooseToJSON(productSchema);

productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
  justOne: false,
});

productSchema.index({ name: 'text', tags: 'text' });
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
    this.slug = await generateUniqueSlug(this.name as any);
  }
  if (!this.sku && this.name) {
    this.sku = await generateUniqueSKU();
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

export const Product: mongoose.Model<IProduct> =  mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema);