import { Document, Types } from 'mongoose';

export interface IBlog extends Document {
  title: string;
  slug: string;
  content: string;
  author: Types.ObjectId;
  featuredImage?: string;
  tags?: string[];
  isPublished: boolean;
  isDeleted: boolean;
}