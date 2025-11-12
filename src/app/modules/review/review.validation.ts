import z from 'zod'

export const reviewValidation = z.object({
  rating: z.coerce.number().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().optional(),
  productId: z.string(),
})