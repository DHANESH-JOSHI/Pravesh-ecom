import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

export const categoryValidation = z.object({
    title: z.string().min(1, 'Title is required'),
    parentCategoryId: objectIdSchema.optional().nullable(),
});

export const categoryUpdateValidation = z.object({
  title: z.string().optional(),
  parentCategoryId: objectIdSchema.optional().nullable(),
});