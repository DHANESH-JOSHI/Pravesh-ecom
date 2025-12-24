import mongoose, { Schema } from 'mongoose';
import { IOrder, OrderStatus, IOrderItem } from './order.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { preventOrderDeletion } from '@/utils/cascadeDelete';

const OrderItemSchema = new Schema<IOrderItem>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, required: true },
  variantSelections: { type: Object, default: {} },
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

OrderSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as any;
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    return next(preventOrderDeletion());
  }
  next();
});

OrderSchema.pre("updateOne", async function (next) {
  const update = this.getUpdate() as any;
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    return next(preventOrderDeletion());
  }
  next();
});

OrderSchema.pre("updateMany", async function (next) {
  const update = this.getUpdate() as any;
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    return next(preventOrderDeletion());
  }
  next();
});

OrderSchema.pre("findOneAndDelete", function (next: any) {
  return next(preventOrderDeletion());
});

OrderSchema.pre("deleteOne", function (next: any) {
  return next(preventOrderDeletion());
});

OrderSchema.pre("deleteMany", function (next: any) {
  return next(preventOrderDeletion());
});

export const Order: mongoose.Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);