import { Types } from 'mongoose';
import z from 'zod'

const objectIdValidation = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  }).transform((val) => new Types.ObjectId(val));

export const reviewValidation = z.object({
    rating: z.coerce.number().min(1).max(5, "Rating must be between 1 and 5"),
    comment: z.string().optional(),
    productId: objectIdValidation,
})