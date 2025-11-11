import { z } from "zod";
import { objectIdValidation } from "../category/category.validation";

export const brandValidation = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  categoryIds: objectIdValidation.array().optional()
});

export const brandUpdateValidation = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").optional(),
  categoryIds: objectIdValidation.array().optional()
});
