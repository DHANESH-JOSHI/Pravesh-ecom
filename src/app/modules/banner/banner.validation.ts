import { z } from 'zod';
import { BannerType } from './banner.interface';

export const createBannerValidation = z.object({
  title: z.string().min(1, 'Title is required'),
  image: z.url('Image URL must be a valid URL').optional(),
  targetUrl: z.string().optional(),
  type: z.enum(BannerType).optional(),
  targetId: z.string().optional(),
  isDeleted: z.coerce.boolean().optional().default(false),
  order: z.coerce.number().optional().default(0),
});

export const updateBannerValidation = createBannerValidation.partial();