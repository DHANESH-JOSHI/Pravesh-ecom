import { Document, Types } from 'mongoose';
export interface IBrand extends Document {
  name: string;
  image?: string;
  category:Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}