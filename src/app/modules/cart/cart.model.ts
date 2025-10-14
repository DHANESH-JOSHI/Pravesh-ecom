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
    },
    price: {
      type: Number,
      required: true,
    },
    selectedColor: {
      type: String,
    },
    selectedSize: {
      type: String,
    },
  },
  { _id: false }
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtuals for calculated properties
CartSchema.virtual('totalPrice').get(function (this: ICart) {
  return this.items.reduce((total, item) => total + item.quantity * item.price, 0);
});

CartSchema.virtual('totalItems').get(function (this: ICart) {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Instance method to add an item
CartSchema.methods.addItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
  quantity: number,
  price: number,
  selectedColor?: string,
  selectedSize?: string
) {
  const existingItemIndex = this.items.findIndex(
    (item) =>
      item.product.equals(productId) &&
      item.selectedColor === selectedColor &&
      item.selectedSize === selectedSize
  );

  if (existingItemIndex > -1) {
    // Item already exists, update quantity
    this.items[existingItemIndex].quantity += quantity;
  } else {
    // Add new item
    this.items.push({ product: productId, quantity, price, selectedColor, selectedSize });
  }
  return this.save();
};

// Instance method to update an item's quantity
CartSchema.methods.updateItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
  quantity: number,
  selectedColor?: string,
  selectedSize?: string
) {
  const itemIndex = this.items.findIndex(
    (item) =>
      item.product.equals(productId) &&
      item.selectedColor === selectedColor &&
      item.selectedSize === selectedSize
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
  selectedColor?: string,
  selectedSize?: string
) {
  this.items = this.items.filter(
    (item) =>
      !(item.product.equals(productId) &&
      item.selectedColor === selectedColor &&
      item.selectedSize === selectedSize)
  );
  return this.save();
};

// Instance method to clear the cart
CartSchema.methods.clearCart = async function (this: ICart) {
  this.items = [];
  return this.save();
};

export const Cart = mongoose.model<ICart, ICartModel>('Cart', CartSchema);
