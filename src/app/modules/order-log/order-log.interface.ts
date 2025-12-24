import { Document } from "mongoose";

export interface IOrderLog extends Document {
  order?: string; // Order ID (optional for list views)
  admin: string; // Admin ID who made the change
  action: string; // 'status_update', 'item_added', 'item_updated', 'item_removed', 'address_changed', 'view', 'view_list', etc.
  field?: string; // Field that was changed (e.g., 'status', 'items', 'shippingAddress')
  oldValue?: any; // Previous value
  newValue?: any; // New value
  description: string; // Human-readable description
  metadata?: Record<string, any>; // Additional metadata
  createdAt: Date;
}

