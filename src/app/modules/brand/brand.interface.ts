import { Document, Types } from 'mongoose';
export interface IBrand extends Document {
  name: string;
  slug:string;
  image?: string;
  categories:Types.ObjectId[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}