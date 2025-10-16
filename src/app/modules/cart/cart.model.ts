import mongoose, { Schema } from 'mongoose';
import { ICart, ICartItem, ICartModel } from './cart.interface';

const CartItemSchema = new Schema<ICartItem>(
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

const CartSchema = new Schema<ICart, ICartModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: [CartItemSchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret: any) {
        if (ret.createdAt && typeof ret.createdAt !== 'string') {
          ret.createdAt = ret.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
        if (ret.updatedAt && typeof ret.updatedAt !== 'string') {
          ret.updatedAt = ret.updatedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
      }
    }
  }
);

// Instance method to add an item
CartSchema.methods.addItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
  quantity: number,
) {
  const existingItemIndex = this.items.findIndex(
    (item) =>
      item.product.equals(productId)
  );

  if (existingItemIndex > -1) {
    // Item already exists, update quantity
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    this.items.push({ product: productId, quantity });
  }
  return this.save();
};

// Instance method to update an item's quantity
CartSchema.methods.updateItem = async function (
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
    // If quantity is 0 or less, remove the item
    this.items.splice(itemIndex, 1);
  } else {
    this.items[itemIndex].quantity = quantity;
  }
  return this.save();
};

// Instance method to remove an item
CartSchema.methods.removeItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
) {
  this.items = this.items.filter(
    (item) =>
      !(item.product.equals(productId))
  );
  return this.save();
};

// Instance method to clear the cart
CartSchema.methods.clearCart = async function (this: ICart) {
  this.items = [];
  return this.save();
};

CartSchema.methods.getCartSummary = async function (this: ICart) {
  const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  const populatedProduct = await this.populate('items.product', 'finalPrice');
  const totalPrice = populatedProduct.items.reduce((sum, item) => {
    const product = item.product as unknown as { finalPrice: number };
    return sum + (item.quantity * product.finalPrice);
  }, 0)
  return { totalItems, totalPrice };
}

export const Cart = mongoose.model<ICart, ICartModel>('Cart', CartSchema);
