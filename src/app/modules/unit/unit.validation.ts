import { z } from "zod";

export const createUnitValidation = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be at most 50 characters"),
});

export const updateUnitValidation = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be at most 50 characters").optional(),
});

