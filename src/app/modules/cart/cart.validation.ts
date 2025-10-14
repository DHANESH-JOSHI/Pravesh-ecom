import { z } from 'zod';
import mongoose from 'mongoose';

const addToCartValidation = z.object({
  productId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  }),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  selectedColor: z.string().optional(),
  selectedSize: z.string().optional(),
});

const updateCartItemValidation = z.object({
  quantity: z.number().int().min(0, 'Quantity must be a non-negative integer'),
  selectedColor: z.string().optional(),
  selectedSize: z.string().optional(),
});

const removeCartItemValidation = z.object({
  selectedColor: z.string().optional(),
  selectedSize: z.string().optional(),
});

export {
  addToCartValidation,
  updateCartItemValidation,
  removeCartItemValidation,
};