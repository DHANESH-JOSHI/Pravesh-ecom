import mongoose, { Schema } from "mongoose";
import { IOrderLog } from "./order-log.interface";
import applyMongooseToJSON from "@/utils/mongooseToJSON";

const OrderLogSchema = new Schema<IOrderLog>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: false, index: true } as any,
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true } as any,
    action: { type: String, required: true, index: true },
    field: { type: String },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

applyMongooseToJSON(OrderLogSchema);

OrderLogSchema.index({ order: 1, createdAt: -1 });
OrderLogSchema.index({ admin: 1, createdAt: -1 });
OrderLogSchema.index({ createdAt: -1 });

export const OrderLog: mongoose.Model<IOrderLog> =
  mongoose.models.OrderLog || mongoose.model<IOrderLog>("OrderLog", OrderLogSchema);

