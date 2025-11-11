import mongoose, { Schema } from 'mongoose';
import { ICategory } from './category.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { generateUniqueSlug } from '@/utils/slugify';

const categorySchema: Schema = new Schema<ICategory>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    slug: { type: String, required: true, unique: true, lowercase: true },
    // image: {
    //   type: String,
    // },
    brands: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Brand',
      }
    ],
    isDeleted: {
      type: Boolean,
      default: false
    },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    path: [
      {
        type: String
      }
    ]
  },
  {
    timestamps: true,
  }
);

applyMongooseToJSON(categorySchema);

categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
  justOne: false,
  match: { isDeleted: false }
})

categorySchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'category',
  justOne: false,
  match: { isDeleted: false }
})

categorySchema.index({ createdAt: -1 });
categorySchema.index({ title: 'text' });
categorySchema.index({ parentCategory: -1 });
categorySchema.index({ isDeleted: -1 });
categorySchema.index({ parentCategory: 1, title: 1 }, { unique: true });

categorySchema.pre("validate", async function (next) {
  if (!this.slug && this.title) {
    this.slug = await generateUniqueSlug(this.title as any);
  }
  next();
});

categorySchema.pre("save", async function (next) {
  if (this.parentCategory) {
    const parent = await mongoose.model("Category").findById(this.parentCategory);
    if (parent) {
      this.path = [...parent.path, this.slug];
    }
  } else {
    this.path = [this.slug];
  }
  next();
});
export const Category: mongoose.Model<ICategory> =  mongoose.models.Category || mongoose.model<ICategory>('Category', categorySchema);
