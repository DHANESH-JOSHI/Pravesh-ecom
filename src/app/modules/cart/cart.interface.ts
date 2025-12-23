import { Document, Model, Types } from 'mongoose';

export interface ICartItem {
  product: Types.ObjectId;
  quantity: number;
  unit?: string; // selected unit for this cart item
}

export interface ICart extends Document {
  user: Types.ObjectId;
  items: ICartItem[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  addItem(
    productId: Types.ObjectId,
    quantity: number,
    unit?: string,
  ): Promise<this>;
  updateItem(
    productId: Types.ObjectId,
    quantity: number,
    unit?: string,
  ): Promise<this>;
  removeItem(productId: Types.ObjectId): Promise<this>;
  clearCart(): Promise<this>;
  getCartSummary(): Promise<{ totalItems: number }>;
}

export interface ICartFilter {
  user?: string;
  isDeleted?: boolean;
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
}

export interface IAddToCartRequest {
  productId: string;
  quantity: number;
  unit?: string;
}

export interface IUpdateCartItemRequest {
  quantity: number;
  unit?: string;
}

export interface ICartSummary {
  totalItems: number;
  itemCount: number;
}

export interface ICartModel extends Model<ICart> {
  findUserCart(userId: Types.ObjectId): Promise<ICart | null>;
}
