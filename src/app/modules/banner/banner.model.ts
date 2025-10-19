import mongoose, { Schema } from 'mongoose';
import { BannerType, IBanner } from './banner.interface';

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    targetUrl: { type: String },
    targetType: {
      type: String,
      enum: BannerType,
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId },
    isDeleted: { type: Boolean, default: true },
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

export const Banner = mongoose.model<IBanner>('Banner', BannerSchema);