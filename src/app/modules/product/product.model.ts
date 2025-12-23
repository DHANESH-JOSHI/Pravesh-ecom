import mongoose, { Schema } from "mongoose";
import { IProduct } from "./product.interface";
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { generateUniqueSlug } from "@/utils/slugify";
import { generateUniqueSKU } from "@/utils/skuify";
import { cascadeProductDelete } from '@/utils/cascadeDelete';

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, unique: true, trim: true },
    sku: { type: String, unique: true, trim: true },
    brand: { type: Schema.Types.ObjectId, ref: "Brand" },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    units: [{
    unit: {
      type: String,
      required: true,
    },
    }],
    specifications: {
      type: Object,
      default: {},
    },
    thumbnail: { type: String },
    tags: [{ type: String, trim: true }],
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
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

productSchema.index({ slug: 1, isDeleted: 1 });
productSchema.index({ sku: 1, isDeleted: 1 });
productSchema.index({ isDeleted: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ isDeleted: 1, isNewArrival: 1, createdAt: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ rating: -1 });
productSchema.index({ totalSold: -1 });
productSchema.index({ salesCount: -1 });

productSchema.pre("validate", async function (next) {
  if (this.isModified('name') || !this.slug) {
    if (this.name) {
      this.slug = await generateUniqueSlug(this.name as any, 'Product');
    }
  }
  if (!this.sku && this.name) {
    this.sku = await generateUniqueSKU();
  }
  next();
});
productSchema.pre("save", function (next) {
  // Ensure at least one unit exists
  if (!this.units || this.units.length === 0) {
    return next(new Error('At least one unit is required'));
  }
  
  // Ensure no duplicate units
  const unitNames = this.units.map(u => u.unit.toLowerCase().trim());
  const uniqueUnits = new Set(unitNames);
  if (uniqueUnits.size !== unitNames.length) {
    return next(new Error('Duplicate units are not allowed'));
  }
  
  next();
});

productSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const productId = query._id;
    
    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (product) {
      const session = this.getOptions().session || undefined;
      try {
        await cascadeProductDelete(productId as mongoose.Types.ObjectId, { session });
      } catch (error: any) {
        return next(error);
      }
    }
  }
  
  // Ensure units array is valid
  const units = update?.units || update?.$set?.units;
  if (units && Array.isArray(units)) {
    if (units.length === 0) {
      return next(new Error('At least one unit is required'));
    }
    
    // Ensure no duplicate units
    const unitNames = units.map((u: any) => (u.unit || '').toLowerCase().trim());
    const uniqueUnits = new Set(unitNames);
    if (uniqueUnits.size !== unitNames.length) {
      return next(new Error('Duplicate units are not allowed'));
    }
  }
  
  if (update?.name || update?.$set?.name) {
    const newName = update?.name || update?.$set?.name;
    if (newName) {
      const excludeId = query._id ? String(query._id) : undefined;
      const newSlug = await generateUniqueSlug(newName, 'Product', excludeId);
      if (update.$set) {
        update.$set.slug = newSlug;
      } else {
        update.slug = newSlug;
      }
    }
  }
  
  next();
});

productSchema.pre("updateOne", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const productId = query._id;
    
    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (product) {
      const session = this.getOptions().session || undefined;
      try {
        await cascadeProductDelete(productId as mongoose.Types.ObjectId, { session });
      } catch (error: any) {
        return next(error);
      }
    }
  }
  
  // Ensure units array is valid
  const units = update?.units || update?.$set?.units;
  if (units && Array.isArray(units)) {
    if (units.length === 0) {
      return next(new Error('At least one unit is required'));
    }
    
    // Ensure no duplicate units
    const unitNames = units.map((u: any) => (u.unit || '').toLowerCase().trim());
    const uniqueUnits = new Set(unitNames);
    if (uniqueUnits.size !== unitNames.length) {
      return next(new Error('Duplicate units are not allowed'));
    }
  }
  
  if (update?.name || update?.$set?.name) {
    const newName = update?.name || update?.$set?.name;
    if (newName) {
      const excludeId = query._id ? String(query._id) : undefined;
      const newSlug = await generateUniqueSlug(newName, 'Product', excludeId);
      if (update.$set) {
        update.$set.slug = newSlug;
      } else {
        update.slug = newSlug;
      }
    }
  }
  
  next();
});

productSchema.pre("updateMany", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const products = await Product.find({ ...query, isDeleted: false });
    const session = this.getOptions().session;
    
    try {
      for (const product of products) {
        await cascadeProductDelete(product._id as mongoose.Types.ObjectId, { session: session || undefined });
      }
    } catch (error: any) {
      return next(error);
    }
  }
  
  next();
});

export const Product: mongoose.Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema);