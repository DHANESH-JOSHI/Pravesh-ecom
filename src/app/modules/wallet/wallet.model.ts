import mongoose, { Schema } from 'mongoose';
import { IWallet } from './wallet.interface';

const TransactionSchema = new Schema(
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

const WalletSchema = new Schema(
    {
        userId: {
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
        toJSON: {
            transform: function (doc, ret) {
                (ret as any).createdAt = new Date((ret as any).createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                (ret as any).updatedAt = new Date((ret as any).updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
            }
        }
    }
);

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
