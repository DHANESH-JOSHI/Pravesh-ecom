import mongoose, { Schema } from 'mongoose';
import { IWallet, ITransaction } from './wallet.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';

const TransactionSchema = new Schema<ITransaction>(
  {
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const WalletSchema = new Schema<IWallet>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      required: true
    },
    balance: {
      type: Number,
      default: 0
    },
    transactions: [TransactionSchema]
  },
  {
    timestamps: true,
  }
);
applyMongooseToJSON(WalletSchema);

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
