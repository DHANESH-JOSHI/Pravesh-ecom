import mongoose from "mongoose"
import { IBrand } from './brand.interface'

const brandSchema = new mongoose.Schema<IBrand>({
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
            transform: function (doc, ret:any) {
                ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
                return ret;
            }
        }
    })
export const Brand = mongoose.model<IBrand>('Brand', brandSchema);

