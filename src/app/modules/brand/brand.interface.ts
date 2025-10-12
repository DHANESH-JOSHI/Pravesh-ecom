import { Document } from 'mongoose';
export interface IBrand extends Document {
    name: string;
    image: string;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}