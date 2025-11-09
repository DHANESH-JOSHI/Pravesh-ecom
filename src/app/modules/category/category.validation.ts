import { z } from 'zod';
import { Types } from "mongoose";

export const objectIdValidation = z
  .string()
  .refine((val) => val && Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  }).transform((val) => new Types.ObjectId(val));

export const categoryValidation = z.object({
  title: z.string().min(1, 'Title is required'),
  parentCategoryId: objectIdValidation.optional(),
});

export const categoryUpdateValidation = z.object({
  title: z.string().optional(),
  parentCategoryId: objectIdValidation.optional(),
});