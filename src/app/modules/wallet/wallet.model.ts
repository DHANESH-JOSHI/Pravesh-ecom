import mongoose, { Schema } from 'mongoose';
import { IWallet,ITransaction } from './wallet.interface';

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
            transform: function (doc, ret:any) {
                if (ret.createdAt && typeof ret.createdAt !== 'string') {
                    ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                }
                if (ret.updatedAt && typeof ret.updatedAt !== 'string') {
                    ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                }
            }
        }
    }
);

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
