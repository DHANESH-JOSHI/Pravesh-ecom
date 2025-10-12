import { Document } from 'mongoose';

export interface ICategory extends Document {
  title: string;
  image: string;
  parentId?: ICategory['_id'] | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
