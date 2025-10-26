import mongoose, { Schema } from 'mongoose';
import { BannerType, IBanner } from './banner.interface';

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true },
    image: { type: String, required: true },
    targetUrl: { type: String },
    type: {
      type: String,
      enum: BannerType,
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId },
    isDeleted: { type: Boolean, default: true },
    order: { type: Number, default: 0, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret: any) {
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

export const Banner = mongoose.model<IBanner>('Banner', BannerSchema);