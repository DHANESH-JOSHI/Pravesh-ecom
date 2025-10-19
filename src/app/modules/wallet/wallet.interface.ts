import { Document, Schema } from "mongoose";

export interface ITransaction {
  amount: number;
  description?: string;
  createdAt: Date;
}
export interface IWallet extends Document {
  userId: Schema.Types.ObjectId;
  balance: number;
  transactions: ITransaction[];
}