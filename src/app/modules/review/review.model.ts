import mongoose from 'mongoose'
import { IReview } from './review.interface'
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { recalculateProductRating } from '@/utils/cascadeDelete';
import { logger } from '@/config/logger';


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

reviewSchema.post("findOneAndDelete", async function (doc) {
  if (doc && doc.product) {
    try {
      await recalculateProductRating(doc.product);
    } catch (error) {
      logger.error('[REVIEW] Failed to recalculate product rating:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

reviewSchema.post("deleteOne", async function () {
  try {
    const doc = await this.model.findOne(this.getQuery());
    if (doc && doc.product) {
      await recalculateProductRating(doc.product);
    }
  } catch (error) {
    logger.error('[REVIEW] Failed to recalculate product rating:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

reviewSchema.post("deleteMany", async function () {
  try {
    const deletedReviews = await this.model.find(this.getQuery());
    const productIds = new Set<string>();
    for (const review of deletedReviews) {
      if (review.product) {
        productIds.add(String(review.product));
      }
    }
    for (const productId of productIds) {
      await recalculateProductRating(new mongoose.Types.ObjectId(productId));
    }
  } catch (error) {
    logger.error('[REVIEW] Failed to recalculate product ratings:', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export const Review: mongoose.Model<IReview> =  mongoose.models.Review || mongoose.model<IReview>('Review', reviewSchema)