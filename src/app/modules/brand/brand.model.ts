import mongoose, { Schema } from "mongoose"
import { IBrand } from './brand.interface'
import applyMongooseToJSON from '@/utils/mongooseToJSON';

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
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
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
brandSchema.index({ name: 'text' });
brandSchema.index({ createdAt: -1, isDeleted: 1 });
export const Brand = mongoose.model<IBrand>('Brand', brandSchema);
