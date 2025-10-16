import { z } from "zod";
import { Types } from "mongoose";

const objectIdValidation = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  }).transform((val) => new Types.ObjectId(val));

export const addFundsValidation = z.object({
    userId: objectIdValidation,
    amount: z.coerce.number().positive("Amount must be a positive number"),
    description: z.string().optional(),
});
