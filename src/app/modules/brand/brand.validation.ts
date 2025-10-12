import { z } from "zod";

export const brandValidation = z.object({
    title: z.string().min(2, "Title must be at least 2 characters long"),
    image: z.url("Image must be a valid URL"),
});

export const brandUpdateValidation = z.object({
    title: z.string().min(2, "Title must be at least 2 characters long").optional(),
    image: z.url("Image must be a valid URL").optional(),
    isDeleted: z.boolean().optional(),
});

