import mongoose, { Schema } from 'mongoose';
import { BannerType, IBanner } from './banner.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';

const bannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true },
    image: { type: String, required: true },
    targetUrl: { type: String },
    type: {
      type: String,
      enum: Object.values(BannerType),
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId },
    isDeleted: { type: Boolean, default: true },
    order: { type: Number, default: 0, index: true },
  },
  {
    timestamps: true,
  }
);

applyMongooseToJSON(bannerSchema);

bannerSchema.index({ type: 1 })
bannerSchema.index({ createdAt: -1, isDeleted: 1 })

export const Banner: mongoose.Model<IBanner> = mongoose.models.Banner || mongoose.model<IBanner>('Banner', bannerSchema);