import { Document } from "mongoose";
export type ContactStatus = "open" | "resolved";
export interface IContact extends Document {
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: ContactStatus;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}