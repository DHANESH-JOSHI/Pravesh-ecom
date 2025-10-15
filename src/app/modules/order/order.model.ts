import mongoose, { Schema } from 'mongoose';
import { IOrder, OrderStatus,IOrderItem } from './order.interface';

const OrderItemSchema = new Schema<IOrderItem>({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    selectedColor: { type: String },
    selectedSize: { type: String },
}, { _id: false });

const OrderSchema = new Schema<IOrder>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        items: [OrderItemSchema],
        totalAmount: { type: Number, required: true, min: 0 },
        shippingAddress: {
            type: Schema.Types.ObjectId,
            ref: 'Address',
            required: true,
        },
        status: {
            type: String,
            enum: Object.values(OrderStatus),
            default: OrderStatus.Pending,
        },
        isCustomOrder: {
            type: Boolean,
            default: false,
        },
        feedback: { type: String },
    },
    {
        timestamps: true,
        toJSON: {
            transform: function (doc, ret:any) {
                ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                });
                ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                });
                return ret;
            },
        },
    }
);

OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);