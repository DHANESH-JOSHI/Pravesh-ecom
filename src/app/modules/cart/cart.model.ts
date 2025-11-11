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
) {
  const existingItemIndex = this.items.findIndex(
    (item) =>
      item.product.equals(productId)
  );

  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += quantity;
  } else {
    this.items.push({ product: productId, quantity });
  }
  return this.save();
};

cartSchema.methods.updateItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
  quantity: number,
) {
  const itemIndex = this.items.findIndex(
    (item) =>
      item.product.equals(productId)
  );

  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }

  if (quantity <= 0) {
    this.items.splice(itemIndex, 1);
  } else {
    this.items[itemIndex].quantity = quantity;
  }
  return this.save();
};

cartSchema.methods.removeItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
) {
  this.items = this.items.filter(
    (item) =>
      !(item.product.equals(productId))
  );
  return this.save();
};

cartSchema.methods.clearCart = async function (this: ICart) {
  this.items = [];
  return this.save();
};

cartSchema.methods.getCartSummary = async function (this: ICart) {
  const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  const populatedProduct = await this.populate('items.product', 'originalPrice');
  const totalPrice = populatedProduct.items.reduce((sum, item) => {
    const product = item.product as unknown as { originalPrice: number };
    return sum + (item.quantity * product.originalPrice);
  }, 0)
  return { totalItems, totalPrice };
}

export const Cart: mongoose.Model<ICart> = mongoose.models.Cart || mongoose.model<ICart, ICartModel>('Cart', cartSchema);
