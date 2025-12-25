import { Types } from "mongoose";
import { Document } from "mongoose";

export enum BannerType {
  Product = 'product',
  Category = 'category',
  Brand = 'brand',
  Offer = 'offer',
  External = 'external',
}


export interface IBanner extends Document {
  title: string;
  image: string;
  targetUrl?: string;
  type: BannerType;
  targetId?: Types.ObjectId;
  targetSlug?: string;
  isDeleted: boolean;
  order: number;
}