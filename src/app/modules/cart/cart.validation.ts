import { z } from 'zod';
import { Types } from "mongoose";

const objectIdValidation = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  }).transform((val) => new Types.ObjectId(val));

const addToCartValidation = z.object({
  productId: objectIdValidation,
  quantity: z.number().int().positive('Quantity must be a positive integer'),
});

const updateCartItemValidation = z.object({
  quantity: z.number().int().min(0, 'Quantity must be a non-negative integer'),
});

export {
  addToCartValidation,
  updateCartItemValidation,
};