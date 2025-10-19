import { Document, Model, Types } from 'mongoose';

export interface ICartItem {
  product: Types.ObjectId;
  quantity: number;
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
  ): Promise<this>;
  updateItem(
    productId: Types.ObjectId,
    quantity: number,
  ): Promise<this>;
  removeItem(productId: Types.ObjectId): Promise<this>;
  clearCart(): Promise<this>;
  getCartSummary(): Promise<{ totalItems: number; totalPrice: number }>;
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
}

export interface IUpdateCartItemRequest {
  quantity: number;
}

export interface ICartSummary {
  totalItems: number;
  totalPrice: number;
  itemCount: number;
}

export interface ICartModel extends Model<ICart> {
  findUserCart(userId: Types.ObjectId): Promise<ICart | null>;
}
