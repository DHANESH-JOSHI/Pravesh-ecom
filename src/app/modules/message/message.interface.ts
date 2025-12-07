import { Document } from "mongoose";
export type MessageStatus = "open" | "resolved";
export interface IMessage extends Document {
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: MessageStatus;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}