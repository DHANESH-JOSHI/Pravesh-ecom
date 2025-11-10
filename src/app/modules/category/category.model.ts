import mongoose, { Schema } from 'mongoose';
import { ICategory } from './category.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';

const categorySchema: Schema = new Schema<ICategory>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    // image: {
    //   type: String,
    // },
    isDeleted: {
      type: Boolean,
      default: false
    },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    }
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

categorySchema.virtual('brands', {
  ref: 'Brand',
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
export const Category = mongoose.model<ICategory>('Category', categorySchema);
