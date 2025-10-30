import { Document, Types } from 'mongoose';

export interface ICategory extends Document {
  title: string;
  image?: string;
  parentCategory?: Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
