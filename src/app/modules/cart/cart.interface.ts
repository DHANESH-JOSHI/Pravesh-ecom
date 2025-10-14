import { Document, Model, Types } from 'mongoose';

// Cart Item Interface
export interface ICartItem {
    product: Types.ObjectId;
    quantity: number;
    price: number;
    selectedColor?: string;
    selectedSize?: string;
}

// Main Cart Interface
export interface ICart extends Document {
  user: Types.ObjectId;
  items: ICartItem[];
  totalItems: number;
  totalPrice: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  // virtuals
  itemCount?: number;

  // Instance methods
  addItem(
    productId: Types.ObjectId,
    quantity: number,
    price: number,
    selectedColor?: string,
    selectedSize?: string,
  ): Promise<this>;
  updateItem(
    productId: Types.ObjectId,
    quantity: number,
    selectedColor?: string,
    selectedSize?: string,
  ): Promise<this>;
  removeItem(productId: Types.ObjectId, selectedColor?: string, selectedSize?: string): Promise<this>;
  clearCart(): Promise<this>;
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
    selectedColor?: string;
    selectedSize?: string;
}

// Update Cart Item Request
export interface IUpdateCartItemRequest {
    quantity: number;
    selectedColor?: string;
    selectedSize?: string;
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
