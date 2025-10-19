import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdValidation = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid product ObjectId',
  });

export const addOrRemoveProductValidation = z.object({
  productId: objectIdValidation,
});