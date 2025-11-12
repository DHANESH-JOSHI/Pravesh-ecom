import { z } from "zod";

export const brandValidation = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  categoryIds: z.preprocess((val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return val; }
    }
    return val;
  }, z.array(z.string()).refine(val => typeof val === 'object' && val !== null, {
    message: "CategoryIds must be a valid array.",
  }).optional()),
});

export const brandUpdateValidation = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").optional(),
  categoryIds: z.preprocess((val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return val; }
    }
    return val;
  }, z.array(z.string()).refine(val => typeof val === 'object' && val !== null, {
    message: "CategoryIds must be a valid array.",
  }).optional()),
});
