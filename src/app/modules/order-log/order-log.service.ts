import { OrderLog } from "./order-log.model";
import { Types } from "mongoose";

interface LogOrderChangeParams {
  orderId?: string | Types.ObjectId; // Optional for list views
  adminId: string | Types.ObjectId;
  action: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
  description: string;
  metadata?: Record<string, any>;
}

export const logOrderChange = async (params: LogOrderChangeParams) => {
  try {
    await OrderLog.create({
      order: params.orderId || undefined,
      admin: params.adminId,
      action: params.action,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      description: params.description,
      metadata: params.metadata || {},
    });
  } catch (error) {
    console.error("Failed to log order change:", error);
    // Don't throw - logging should not break the main flow
  }
};

export const getOrderLogs = async (orderId: string | Types.ObjectId, limit = 50) => {
  return await OrderLog.find({ order: orderId })
    .populate("admin", "name email role")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

export const getRecentLogs = async (limit = 100) => {
  return await OrderLog.find()
    .populate("order", "status user")
    .populate("admin", "name email role")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

