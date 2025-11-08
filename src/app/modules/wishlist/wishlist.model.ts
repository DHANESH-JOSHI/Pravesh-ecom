import { Schema, model } from 'mongoose';
import { IWishlist } from './wishlist.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';

const WishlistSchema = new Schema<IWishlist>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  {
    timestamps: true,
  }
);
applyMongooseToJSON(WishlistSchema);

export const Wishlist = model<IWishlist>('Wishlist', WishlistSchema);