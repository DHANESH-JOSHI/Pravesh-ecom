import mongoose, { Schema } from "mongoose";
import { IProduct } from "./product.interface";
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { generateUniqueSlug } from "@/utils/slugify";
import { generateUniqueSKU } from "@/utils/skuify";
import { cascadeProductDelete } from '@/utils/cascadeDelete';

// Helper function to validate specifications
const validateSpecifications = (specs: any, errorPrefix: string = ''): Error | null => {
  if (!specs || typeof specs !== 'object') {
    return null;
  }
  for (const [key, value] of Object.entries(specs)) {
    if (value !== null && value !== undefined) {
      const isString = typeof value === 'string';
      const isStringArray = Array.isArray(value) && value.every(item => typeof item === 'string');
      if (!isString && !isStringArray) {
        return new Error(`${errorPrefix}Specification value for "${key}" must be either a string or an array of strings`);
      }
    }
  }
  return null;
};

// Helper function to validate variants
const validateVariants = (variants: any, errorPrefix: string = ''): Error | null => {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) {
    return null; // Variants are optional
  }
  
  // Check for duplicate variant keys
  const variantKeys = Object.keys(variants);
  const uniqueKeys = new Set(variantKeys.map(k => k.toLowerCase().trim()));
  if (uniqueKeys.size !== variantKeys.length) {
    return new Error(`${errorPrefix}Duplicate variant keys are not allowed`);
  }
  
  for (const [key, value] of Object.entries(variants)) {
    // Each variant value must be an array of strings
    if (!Array.isArray(value)) {
      return new Error(`${errorPrefix}Variant "${key}" must be an array of strings`);
    }
    
    if (value.length === 0) {
      return new Error(`${errorPrefix}Variant "${key}" must have at least one option`);
    }
    
    // Check that all values in the array are strings
    if (!value.every(item => typeof item === 'string' && item.trim().length > 0)) {
      return new Error(`${errorPrefix}Variant "${key}" must contain only non-empty strings`);
    }
    
    // Check for duplicate values within a variant
    const uniqueValues = new Set(value.map((v: string) => v.toLowerCase().trim()));
    if (uniqueValues.size !== value.length) {
      return new Error(`${errorPrefix}Variant "${key}" contains duplicate values`);
    }
  }
  
  return null;
};

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, unique: true, trim: true },
    sku: { type: String, unique: true, trim: true },
    brand: { type: Schema.Types.ObjectId, ref: "Brand" },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    units: [{
      type: Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
    }],
    variants: {
      type: Object,
      default: {},
    },
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
  
  // Validate specifications: each value must be either a string or an array of strings
  const specsError = validateSpecifications(this.specifications);
  if (specsError) {
    return next(specsError);
  }
  
  // Validate variants: each value must be an array of strings
  const variantsError = validateVariants(this.variants);
  if (variantsError) {
    return next(variantsError);
  }
  
  next();
});
productSchema.pre("save", async function (next) {
  // Ensure at least one unit exists
  if (!this.units || this.units.length === 0) {
    return next(new Error('At least one unit is required'));
  }

  // Ensure no duplicate unit IDs
  const unitIds = this.units.map(u => String(u));
  const uniqueUnits = new Set(unitIds);
  if (uniqueUnits.size !== unitIds.length) {
    return next(new Error('Duplicate units are not allowed'));
  }

  // Validate that all unit IDs exist
  const Unit = mongoose.models.Unit || mongoose.model('Unit');
  const existingUnits = await Unit.find({ 
    _id: { $in: this.units },
    isDeleted: false 
  });
  if (existingUnits.length !== this.units.length) {
    return next(new Error('One or more unit IDs are invalid or deleted'));
  }

  // Validate specifications: each value must be either a string or an array of strings
  const specsError = validateSpecifications(this.specifications);
  if (specsError) {
    return next(specsError);
  }

  // Validate variants: each value must be an array of strings
  const variantsError = validateVariants(this.variants);
  if (variantsError) {
    return next(variantsError);
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

    // Ensure no duplicate unit IDs
    const unitIds = units.map((u: any) => String(u));
    const uniqueUnits = new Set(unitIds);
    if (uniqueUnits.size !== unitIds.length) {
      return next(new Error('Duplicate units are not allowed'));
    }

    // Validate that all unit IDs exist
    const Unit = mongoose.models.Unit || mongoose.model('Unit');
    const existingUnits = await Unit.find({ 
      _id: { $in: units },
      isDeleted: false 
    });
    if (existingUnits.length !== units.length) {
      return next(new Error('One or more unit IDs are invalid or deleted'));
    }
  }

  // Validate specifications: each value must be either a string or an array of strings
  const specifications = update?.specifications || update?.$set?.specifications;
  if (specifications) {
    const specsError = validateSpecifications(specifications);
    if (specsError) {
      return next(specsError);
    }
  }

  // Validate variants: each value must be an array of strings
  const variants = update?.variants || update?.$set?.variants;
  if (variants) {
    const variantsError = validateVariants(variants);
    if (variantsError) {
      return next(variantsError);
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

    // Ensure no duplicate unit IDs
    const unitIds = units.map((u: any) => String(u));
    const uniqueUnits = new Set(unitIds);
    if (uniqueUnits.size !== unitIds.length) {
      return next(new Error('Duplicate units are not allowed'));
    }

    // Validate that all unit IDs exist
    const Unit = mongoose.models.Unit || mongoose.model('Unit');
    const existingUnits = await Unit.find({ 
      _id: { $in: units },
      isDeleted: false 
    });
    if (existingUnits.length !== units.length) {
      return next(new Error('One or more unit IDs are invalid or deleted'));
    }
  }

  // Validate specifications: each value must be either a string or an array of strings
  const specifications = update?.specifications || update?.$set?.specifications;
  if (specifications) {
    const specsError = validateSpecifications(specifications);
    if (specsError) {
      return next(specsError);
    }
  }

  // Validate variants: each value must be an array of strings
  const variants = update?.variants || update?.$set?.variants;
  if (variants) {
    const variantsError = validateVariants(variants);
    if (variantsError) {
      return next(variantsError);
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