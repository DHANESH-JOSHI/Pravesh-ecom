import { Document } from 'mongoose';

export enum OrderStatus {
  Pending = 'pending',
  Processing = 'processing',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
  AwaitingConfirmation = 'awaiting_confirmation',
  AwaitingPayment = 'awaiting_payment',
}

export interface IOrderItem {
  product: string;
  quantity: number;
  price: number; 
  selectedColor?: string;
  selectedSize?: string;
}

export interface IOrder extends Document {
  user: string;
  items: IOrderItem[];
  totalAmount: number;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  status: OrderStatus;
  isCustomOrder: boolean;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}