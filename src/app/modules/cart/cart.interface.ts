import { Document, Model, Types } from 'mongoose';

// Cart Item Interface
export interface ICartItem {
  product: Types.ObjectId;
  quantity: number;
}

// Main Cart Interface
export interface ICart extends Document {
  user: Types.ObjectId;
  items: ICartItem[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
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

// Cart Query Filters
export interface ICartFilter {
  user?: string;
  isDeleted?: boolean;
  createdAt?: {
    $gte?: Date;
    $lte?: Date;
  };
}

// Add to Cart Request
export interface IAddToCartRequest {
  productId: string;
  quantity: number;
}

// Update Cart Item Request
export interface IUpdateCartItemRequest {
  quantity: number;
}

// Cart Summary
export interface ICartSummary {
  totalItems: number;
  totalPrice: number;
  itemCount: number;
}

export interface ICartModel extends Model<ICart> {
  // Static methods
  findUserCart(userId: Types.ObjectId): Promise<ICart | null>;
}
