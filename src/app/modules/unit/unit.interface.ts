import { Document } from 'mongoose';

export interface IUnit extends Document {
  name: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

