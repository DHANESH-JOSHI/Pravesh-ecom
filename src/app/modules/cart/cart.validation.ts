import { z } from 'zod';
import { Types } from "mongoose";

const objectIdValidation = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  }).transform((val) => new Types.ObjectId(val));

const addToCartValidation = z.object({
  productId: objectIdValidation,
  quantity: z.coerce.number().int().positive('Quantity must be a positive integer'),
  unit: z.string().min(1, 'Unit is required'),
});

const updateCartItemValidation = z.object({
  quantity: z.coerce.number().int().min(0, 'Quantity must be a non-negative integer'),
  unit: z.string().min(1, 'Unit is required'),
});

export {
  addToCartValidation,
  updateCartItemValidation,
};