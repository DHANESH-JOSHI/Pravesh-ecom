import mongoose from "mongoose"
import { IBrand } from './brand.interface'
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { generateUniqueSlug } from "@/utils/slugify";

const brandSchema = new mongoose.Schema<IBrand>(
  {
    name: {
      type: String,
      required: true,
      unique: true
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

brandSchema.index({ name: 'text' });
brandSchema.index({ createdAt: -1, isDeleted: 1 });
export const Brand: mongoose.Model<IBrand> = mongoose.models.Brand || mongoose.model<IBrand>('Brand', brandSchema);
