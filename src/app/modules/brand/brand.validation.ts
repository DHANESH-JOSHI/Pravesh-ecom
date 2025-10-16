import { z } from "zod";

export const brandValidation = z.object({
    name: z.string().min(2, "Name must be at least 2 characters long"),
});

export const brandUpdateValidation = z.object({
    name: z.string().min(2, "Name must be at least 2 characters long").optional(),
});
