import mongoose, { Schema } from 'mongoose';
import { ICategory } from './category.interface';

const categorySchema: Schema = new Schema<ICategory>(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    image: {
      type: String,
    },
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
    toJSON: {
      virtuals: true,
      transform: function (doc, ret: any) {
        if (ret.createdAt && typeof ret.createdAt !== 'string') {
          ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
        if (ret.updatedAt && typeof ret.updatedAt !== 'string') {
          ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
      }
    },
    toObject: {
      virtuals: true
    }
  }
);

categorySchema.virtual('children',{
  ref:'Category',
  localField:'_id',
  foreignField:'parentCategory',
  justOne:false
})

categorySchema.virtual('products',{
  ref:'Product',
  localField:'_id',
  foreignField:'category',
  justOne:false
})
categorySchema.index({ createdAt: -1 });
categorySchema.index({ title: 'text' });
categorySchema.index({ parentCategory: -1 });
categorySchema.index({ isDeleted: -1 });
categorySchema.index({ parentCategory: 1, title: 1 }, { unique: true });
export const Category = mongoose.model<ICategory>('Category', categorySchema);
