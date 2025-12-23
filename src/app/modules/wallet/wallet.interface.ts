import { Document, Types } from "mongoose";

export interface ITransaction {
  amount: number;
  description?: string;
  createdAt: Date;
}
export interface IWallet extends Document {
  user: Types.ObjectId;
  balance: number;
  transactions: ITransaction[];
  isDeleted?: boolean;
}