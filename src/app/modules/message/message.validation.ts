import { z } from "zod";

export const createMessageValidation = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email"),
  subject: z.string().max(300).optional(),
  message: z.string().min(1, "Message is required").max(5000),
});
