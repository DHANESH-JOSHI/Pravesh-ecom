import { Types } from 'mongoose';
import { Document } from 'mongoose';

export enum OrderStatus {
  Processing = 'processing',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
  AwaitingConfirmation = 'awaiting_confirmation',
  AwaitingPayment = 'awaiting_payment',
}

export interface IOrderItem {
  product: Types.ObjectId;
  quantity: number;
  price: number;
}

export interface IOrder extends Document {
  user: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  shippingAddress: Types.ObjectId;
  status: OrderStatus;
  isCustomOrder: boolean;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}