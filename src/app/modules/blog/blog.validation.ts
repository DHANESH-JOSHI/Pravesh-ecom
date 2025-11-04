import { z } from 'zod';

export const createBlogValidation = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long'),
  content: z.string().min(10, 'Content is required'),
  featuredImage: z.url().optional(),
  tags: z.array(z.string()).optional(),
  isPublished: z.coerce.boolean().optional(),
});

export const updateBlogValidation = createBlogValidation.partial();