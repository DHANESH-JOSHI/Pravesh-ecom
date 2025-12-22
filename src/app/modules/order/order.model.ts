import mongoose, { Schema } from 'mongoose';
import { IOrder, OrderStatus, IOrderItem } from './order.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';

const OrderItemSchema = new Schema<IOrderItem>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const OrderHistorySchema = new Schema({
  status: {
    type: String,
    enum: Object.values(OrderStatus),
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [OrderItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    shippingAddress: {
      type: Schema.Types.ObjectId,
      ref: 'Address',
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.Received,
    },
    history: [
      OrderHistorySchema
    ],
    isCustomOrder: {
      type: Boolean,
      default: false,
    },
    feedback: { type: String },
    image: { type: String },
  },
  {
    timestamps: true,
  }
);
applyMongooseToJSON(OrderSchema);

OrderSchema.index({ user: 1, status: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

export const Order: mongoose.Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);