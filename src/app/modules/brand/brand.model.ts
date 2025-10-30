import mongoose from "mongoose"
import { IBrand } from './brand.interface'

const brandSchema = new mongoose.Schema<IBrand>(
  {
    name: {
      type: String,
      required: true,
      unique: true
    },
    image: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
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
        return ret;
      }
    },
    toObject: {
      virtuals: true
    }
  }
)

brandSchema.virtual('products', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'brand',
  justOne: false
});
brandSchema.index({ name: 'text' });
brandSchema.index({ createdAt: -1, isDeleted: 1 });
export const Brand = mongoose.model<IBrand>('Brand', brandSchema);
