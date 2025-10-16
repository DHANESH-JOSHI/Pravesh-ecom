import mongoose, { Schema } from 'mongoose';
import { ICategory } from './category.interface';

const CategorySchema: Schema = new Schema<ICategory>(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    image: {
      type: String,
      required: true
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
      transform: function (doc, ret:any) {
        if (ret.createdAt && typeof ret.createdAt !== 'string') {
          ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
        if (ret.updatedAt && typeof ret.updatedAt !== 'string') {
          ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
      }
    },
  }
);

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
