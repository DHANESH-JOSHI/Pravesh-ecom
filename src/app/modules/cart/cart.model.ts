import mongoose, { Schema } from 'mongoose';
import { ICart, ICartItem, ICartModel } from './cart.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';

const cartItemSchema = new Schema<ICartItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unit: {
      type: String,
      required: true,
    }
  }
);

const cartSchema = new Schema<ICart>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
  },
  {
    timestamps: true,
  }
);
applyMongooseToJSON(cartSchema);

cartSchema.methods.addItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
  quantity: number,
  unit: string,
) {
  // Check if item with same product and unit already exists
  const existingItemIndex = this.items.findIndex(
    (item) =>
      item.product.equals(productId) && item.unit === unit
  );

  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += quantity;
  } else {
    this.items.push({ product: productId, quantity, unit });
  }
  return this.save();
};

cartSchema.methods.updateItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
  quantity: number,
  unit: string,
) {
  const itemIndex = this.items.findIndex(
    (item) =>
      item.product.equals(productId) && item.unit === unit
  );

  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }

  if (quantity <= 0) {
    this.items.splice(itemIndex, 1);
  } else {
    this.items[itemIndex].quantity = quantity;
    this.items[itemIndex].unit = unit;
  }
  return this.save();
};

cartSchema.methods.removeItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
  unit: string,
) {
  this.items = this.items.filter(
    (item) =>
      !(item.product.equals(productId) && item.unit === unit)
  );
  return this.save();
};

cartSchema.methods.clearCart = async function (this: ICart) {
  this.items = [];
  return this.save();
};

cartSchema.methods.getCartSummary = async function (this: ICart) {
  const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  return { totalItems };
}

export const Cart: mongoose.Model<ICart> = mongoose.models.Cart || mongoose.model<ICart, ICartModel>('Cart', cartSchema);
