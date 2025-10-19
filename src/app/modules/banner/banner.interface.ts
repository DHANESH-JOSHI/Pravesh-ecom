import { Types } from "mongoose";
import { Document } from "mongoose";

export enum BannerType {
  Product = 'product',
  Category = 'category',
  Offer = 'offer',
  External = 'external',
}


export interface IBanner extends Document {
  title: string;
  imageUrl: string;
  targetUrl?: string;
  targetType: BannerType;
  targetId?: Types.ObjectId;
  isDeleted: boolean;
  order: number;
}