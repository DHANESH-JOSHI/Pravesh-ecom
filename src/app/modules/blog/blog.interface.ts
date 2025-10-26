import { Document } from 'mongoose';

export interface IBlog extends Document {
  title: string;
  slug: string;
  content: string;
  featuredImage?: string;
  tags?: string[];
  isPublished: boolean;
  isDeleted: boolean;
}