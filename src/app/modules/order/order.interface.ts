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
}

export interface OrderHistory {
  status: OrderStatus;
  timestamp: Date;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  shippingAddress: Types.ObjectId;
  history: OrderHistory[];
  status: OrderStatus;
  isCustomOrder: boolean;
  image?: string;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}