import mongoose from "mongoose"
import { IBrand } from './brand.interface'
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { generateUniqueSlug } from "@/utils/slugify";

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
    const Product = mongoose.model("Product");
    const Category = mongoose.model("Category");
    
    const brand = await Brand.findOne({ _id: brandId, isDeleted: false });
    if (brand) {
      await Promise.all([
        Product.updateMany(
          { brand: brandId, isDeleted: false },
          { $unset: { brand: "" } }
        ),
        Category.updateMany(
          { brands: brandId, isDeleted: false },
          { $pull: { brands: brandId } }
        )
      ]);
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
