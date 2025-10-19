import { Document, Types } from 'mongoose';

export interface IWishlist extends Document {
  user: Types.ObjectId;
  items: Types.ObjectId[];
}