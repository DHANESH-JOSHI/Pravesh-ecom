import mongoose from "mongoose"
import { IBrand } from './brand.interface'

const brandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
},
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret) {
                (ret as any).createdAt = new Date((ret as any).createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                (ret as any).updatedAt = new Date((ret as any).updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                return ret;
            }
        }
    })
export const Brand = mongoose.model<IBrand>('Brand', brandSchema);

