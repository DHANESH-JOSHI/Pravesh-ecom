import { Document, Types } from 'mongoose';

export interface ICategory extends Document {
  title: string;
  slug:string;
  // image?: string;
  parentCategory?: Types.ObjectId;
  brands: Types.ObjectId[];
  path:string[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
