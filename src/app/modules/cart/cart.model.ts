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
    },
    variantSelections: {
      type: Object,
      default: {},
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

// Helper function to compare variant selections
const areVariantsEqual = (v1: Record<string, string> | undefined, v2: Record<string, string> | undefined): boolean => {
  if (!v1 && !v2) return true;
  if (!v1 || !v2) return false;
  const keys1 = Object.keys(v1).sort();
  const keys2 = Object.keys(v2).sort();
  if (keys1.length !== keys2.length) return false;
  return keys1.every(key => v1[key] === v2[key]);
};

cartSchema.methods.addItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
  quantity: number,
  unit: string,
  variantSelections?: Record<string, string>,
) {
  // Check if item with same product, unit, and variant selections already exists
  const existingItemIndex = this.items.findIndex(
    (item) =>
      item.product.equals(productId) && 
      item.unit === unit &&
      areVariantsEqual(item.variantSelections, variantSelections)
  );

  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += quantity;
  } else {
    this.items.push({ product: productId, quantity, unit, variantSelections: variantSelections || {} });
  }
  return this.save();
};

cartSchema.methods.updateItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
  quantity: number,
  unit: string,
  variantSelections?: Record<string, string>,
) {
  const itemIndex = this.items.findIndex(
    (item) =>
      item.product.equals(productId) && 
      item.unit === unit &&
      areVariantsEqual(item.variantSelections, variantSelections)
  );

  if (itemIndex === -1) {
    throw new Error('Item not found in cart');
  }

  if (quantity <= 0) {
    this.items.splice(itemIndex, 1);
  } else {
    this.items[itemIndex].quantity = quantity;
    this.items[itemIndex].unit = unit;
    if (variantSelections) {
      this.items[itemIndex].variantSelections = variantSelections;
    }
  }
  return this.save();
};

cartSchema.methods.removeItem = async function (
  this: ICart,
  productId: mongoose.Types.ObjectId,
  unit: string,
  variantSelections?: Record<string, string>,
) {
  this.items = this.items.filter(
    (item) =>
      !(item.product.equals(productId) && 
        item.unit === unit &&
        areVariantsEqual(item.variantSelections, variantSelections))
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
