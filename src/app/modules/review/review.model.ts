import mongoose from 'mongoose'
import { IReview } from './review.interface'


const reviewSchema = new mongoose.Schema<IReview>({
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
}, {
    timestamps: true,
    toJSON: {
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
})

reviewSchema.index({ createdAt: -1 })

export const Review = mongoose.model<IReview>('Review', reviewSchema)