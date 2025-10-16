import mongoose, { Schema } from 'mongoose';
import { IAddress } from './address.interface';

const AddressSchema = new Schema<IAddress>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        fullname: {
            type: String,
            required: true,
        },
        phone: {
            type: String,
            required: true,
        },
        line1: {
            type: String,
            required: true,
        },
        line2: {
            type: String,
        },
        landmark: {
            type: String,
        },
        city: {
            type: String,
            required: true,
        },
        state: {
            type: String,
            required: true,
        },
        postalCode: {
            type: String,
            required: true,
        },
        country: {
            type: String,
            required: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret: any) {
                if (ret.createdAt && typeof ret.createdAt !== 'string') {
                    ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                }
                if (ret.updatedAt && typeof ret.updatedAt !== 'string') {
                    ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                }
                return ret;
            },
        },
    }
);

AddressSchema.index({ createdAt: -1 });

export const Address = mongoose.model<IAddress>('Address', AddressSchema);