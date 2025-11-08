import mongoose, { Schema } from "mongoose";
import { DiscountType, IProduct, StockStatus, UnitType } from "./product.interface";
import { slugify } from "@/utils/slugify";
import applyMongooseToJSON from '@/utils/mongooseToJSON';

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, unique: true, trim: true },
    sku: { type: String, unique: true, trim: true },
    description: { type: String },
    shortDescription: { type: String },

    brand: { type: Schema.Types.ObjectId, ref: "Brand" },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },

    originalPrice: { type: Number, required: true },
    discountValue: { type: Number, default: 0 },
    discountType: { type: String, enum: DiscountType, default: DiscountType.Percentage },
    finalPrice: { type: Number, default: 0 },
    stock: { type: Number, required: true },
    minStock: { type: Number, default: 0 },
    unit: {
      type: String,
      enum: UnitType,
      required: true,
    },
    stockStatus: {
      type: String,
      enum: StockStatus,
    },
    features: {
      type: [String],
      default: [],
    },
    specifications: {
      type: Map,
      of: String,
      default: {},
    },

    images: [{ type: String, required: true }],
    thumbnail: { type: String, required: true },

    tags: [{ type: String, trim: true }],

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
  }
);

applyMongooseToJSON(productSchema);

productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
  justOne: false,
});

productSchema.index({ name: 'text', description: 'text', tags: 'text', shortDescription: 'text' });
productSchema.index({ slug: 1, isDeleted: 1 });
productSchema.index({ sku: 1, isDeleted: 1 });
productSchema.index({ isDeleted: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ isDeleted: 1, isNewArrival: 1, createdAt: -1 });
productSchema.index({ isDeleted: 1, isDiscount: 1, discountValue: -1 });
productSchema.index({ isDeleted: 1, category: 1, finalPrice: 1 });
productSchema.index({ isDeleted: 1, brand: 1, finalPrice: 1 });
productSchema.index({ finalPrice: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ rating: -1 });
productSchema.index({ totalSold: -1 });
productSchema.index({ salesCount: -1 });

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
/**
 * Reserve a unique slug atomically using a per-base counter.
 *
 * Behavior:
 * - Uses a 'slug_counters' collection; each document _id is the base slug.
 * - findOneAndUpdate with $inc is atomic: first reservation yields seq=1 -> use base.
 *   subsequent reservations yield seq=2 -> base-1, seq=3 -> base-2, etc.
 *
 * This guarantees no two creations receive the same slug even under concurrency.
 */
const reserveSlugAtomic = async (baseName: string) => {
  const base = (slugify(baseName || "") || String(Date.now())).toString();
  const coll = mongoose.connection.collection("slug_counters");
  // Atomically increment sequence for this base slug
  const res = await coll.findOneAndUpdate(
    { _id: base } as any,
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const seq = res?.value && typeof res?.value.seq === "number" ? res.value.seq : 1;
  if (seq === 1) {
    return base;
  }
  // seq=2 => base-1, seq=3 => base-2, ...
  return `${base}-${seq - 1}`;
};

/**
 * Produce a globally unique SKU using an atomic counter.
 *
 * Uses a single 'counters' collection and a document with _id 'product_sku'.
 * Each call atomically increments the counter and returns a formatted SKU.
 *
 * This guarantees every auto-generated SKU is unique under concurrency.
 */
const nextSkuSequence = async () => {
  const coll = mongoose.connection.collection("counters");
  const res = await coll.findOneAndUpdate(
    { _id: "product_sku" } as any,
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const seq = res?.value && typeof res.value.seq === "number" ? res.value.seq : Date.now();
  // Format numeric SKU with padding, e.g., SKU000001
  return `SKU${String(seq).padStart(6, "0")}`;
};

productSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as any;

  // If no $set provided, nothing to do here
  if (!update || !update.$set) {
    return next();
  }

  // only handle finalPrice recalculation on updates (do not auto-generate slug/sku here)
  const needPriceUpdate = update.$set.originalPrice || update.$set.discountValue || update.$set.discountType;

  if (!needPriceUpdate) {
    return next();
  }

  // load existing document to compute derived fields
  this.model
    .findOne(this.getQuery())
    .then((doc: any) => {
      if (!doc) {
        return next();
      }

      const newDoc = { ...doc.toObject(), ...update.$set } as IProduct;

      calculateFinalPrice(newDoc);
      update.$set.finalPrice = newDoc.finalPrice;

      next();
    })
    .catch(next);
});

productSchema.pre("save", function (next) {
  // ensure finalPrice and stockStatus
  calculateFinalPrice(this);
  if (this.stock === 0) {
    this.stockStatus = StockStatus.OutOfStock;
  } else if (this.stock < this.minStock) {
    this.stockStatus = StockStatus.LowStock;
  } else if (this.stock >= this.minStock && this.stockStatus !== StockStatus.InStock) {
    this.stockStatus = StockStatus.InStock;
  }

  // Only generate slug and SKU on creation (isNew). Do not auto-update them on edits.
  if (!this.isNew) {
    return next();
  }

  // Only generate slug and sku on creation (isNew)
  if (this.isNew) {
    const tasks: Promise<void>[] = [];

    // SLUG: if user provided a slug, normalize and reserve it; otherwise derive from name and reserve.
    if (!this.slug && this.name) {
      const base = slugify(this.name);
      const p = reserveSlugAtomic(base)
        .then((slug) => {
          this.slug = slug;
        });
      tasks.push(p);
    } else if (this.slug) {
      // user provided a slug: normalize and attempt to reserve it atomically to avoid collisions
      const baseProvided = slugify(this.slug);
      const p = reserveSlugAtomic(baseProvided)
        .then((reserved) => {
          // If reservation changed (e.g., base -> base-1), assign that value
          this.slug = reserved;
        });
      tasks.push(p);
    }

    // SKU: only auto-generate when not provided by user
    if (!this.sku) {
      const p2 = nextSkuSequence()
        .then((sku) => {
          this.sku = sku;
        });
      tasks.push(p2);
    }

    if (tasks.length === 0) {
      return next();
    }

    Promise.all(tasks)
      .then(() => next())
      .catch((err) => next(err));

    return;
  }

  next();
});

export const Product = mongoose.model<IProduct>('Product', productSchema);