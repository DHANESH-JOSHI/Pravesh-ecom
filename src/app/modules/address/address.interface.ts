import { Document, Types } from 'mongoose';

export interface IAddress extends Document {
  user: Types.ObjectId;
  fullname: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
