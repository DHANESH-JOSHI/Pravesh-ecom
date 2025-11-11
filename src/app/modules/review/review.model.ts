import mongoose from 'mongoose'
import { IReview } from './review.interface'
import applyMongooseToJSON from '@/utils/mongooseToJSON';


const reviewSchema = new mongoose.Schema<IReview>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
    }
  },
  {
    timestamps: true,
  })

applyMongooseToJSON(reviewSchema);

reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ createdAt: -1 });

export const Review: mongoose.Model<IReview> =  mongoose.models.Review || mongoose.model<IReview>('Review', reviewSchema)