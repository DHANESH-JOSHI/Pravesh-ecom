import { Types } from 'mongoose';
import { Document } from 'mongoose';

export enum OrderStatus {
  Received = 'received',
  Approved = 'approved',
  Confirmed = 'confirmed',
  Cancelled = 'cancelled',
  Shipped = 'shipped',
  OutForDelivery = 'out_for_delivery',
  Delivered = 'delivered',
  Refunded = 'refunded',
}

export interface IOrderItem {
  product: Types.ObjectId;
  quantity: number;
  unit: string; // required - unit selected when order was placed
  variantSelections?: Record<string, string>; // Selected variants when order was placed
}

export interface OrderHistory {
  status: OrderStatus;
  timestamp: Date;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: Types.ObjectId;
  history: OrderHistory[];
  status: OrderStatus;
  isCustomOrder: boolean;
  image?: string;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}