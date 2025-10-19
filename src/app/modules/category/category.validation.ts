import { z } from 'zod';
import { Types } from "mongoose";

const objectIdValidation = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  }).transform((val) => new Types.ObjectId(val));

export const categoryValidation = z.object({
  title: z.string().min(1, 'Title is required'),
  parentCategoryId: objectIdValidation.optional().nullable(),
});

export const categoryUpdateValidation = z.object({
  title: z.string().optional(),
  parentCategoryId: objectIdValidation.optional().nullable(),
});