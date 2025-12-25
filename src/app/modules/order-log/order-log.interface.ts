import { Document } from "mongoose";

export enum OrderLogAction {
  LIST = 'list',
  VIEW = 'view',
  UPDATE = 'update',
}

export enum OrderLogField {
  STATUS = 'status',
  ITEMS = 'items',
  FEEDBACK = 'feedback',
}

export interface IOrderLog extends Document {
  order?: string; 
  admin: string; 
  action: OrderLogAction; 
  field?: OrderLogField; 
  oldValue?: any; 
  newValue?: any; 
  description: string; 
  metadata?: Record<string, any>; 
  createdAt: Date;
}

