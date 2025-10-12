import mongoose, { Schema } from 'mongoose';
import { ICategory } from './category.interface';

const CategorySchema: Schema = new Schema(
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
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        (ret as any).createdAt = new Date((ret as any).createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        (ret as any).updatedAt = new Date((ret as any).updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      }
    }
  }
);

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
