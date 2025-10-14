import { z } from "zod";

export const addFundsValidation = z.object({
    userId: z.string().min(1, "User ID is required"),
    amount: z.number().positive("Amount must be a positive number"),
    description: z.string().optional(),
});
