import mongoose from "mongoose"
import { IBrand } from './brand.interface'
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { generateUniqueSlug } from "@/utils/slugify";
import { cascadeBrandDelete } from '@/utils/cascadeDelete';

const brandSchema = new mongoose.Schema<IBrand>(
  {
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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      }
    ]
  },
  {
    timestamps: true,
  }
)

applyMongooseToJSON(brandSchema);

brandSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'brand',
  justOne: false,
  match: { isDeleted: false }
});

brandSchema.pre("validate", async function (next) {
  if (!this.slug && this.name) {
    this.slug = await generateUniqueSlug(this.name as any);
  }
  next();
});

brandSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const brandId = query._id;
    
    const brand = await Brand.findOne({ _id: brandId, isDeleted: false });
    if (brand) {
      const session = this.getOptions().session || undefined;
      try {
        await cascadeBrandDelete(brandId as mongoose.Types.ObjectId, { session });
      } catch (error: any) {
        return next(error);
      }
    }
  }
  
  next();
});

brandSchema.pre("updateOne", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const brandId = query._id;
    
    const brand = await Brand.findOne({ _id: brandId, isDeleted: false });
    if (brand) {
      const session = this.getOptions().session || undefined;
      try {
        await cascadeBrandDelete(brandId as mongoose.Types.ObjectId, { session });
      } catch (error: any) {
        return next(error);
      }
    }
  }
  
  next();
});

brandSchema.pre("updateMany", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const brands = await Brand.find({ ...query, isDeleted: false });
    const session = this.getOptions().session;
    
    try {
      for (const brand of brands) {
        await cascadeBrandDelete(brand._id as mongoose.Types.ObjectId, { session: session || undefined });
      }
    } catch (error: any) {
      return next(error);
    }
  }
  
  next();
});

brandSchema.index({ createdAt: -1, isDeleted: 1 });
brandSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false }
  }
);
export const Brand: mongoose.Model<IBrand> = mongoose.models.Brand || mongoose.model<IBrand>('Brand', brandSchema);
