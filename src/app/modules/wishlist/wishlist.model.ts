import { Schema, model } from 'mongoose';
import { IWishlist } from './wishlist.interface';

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
  { timestamps: true }
);

export const Wishlist = model<IWishlist>('Wishlist', WishlistSchema);