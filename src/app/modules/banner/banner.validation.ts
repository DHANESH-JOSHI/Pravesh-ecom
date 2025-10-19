import { z } from 'zod';
import { BannerType } from './banner.interface';

export const createBannerValidation = z.object({
  title: z.string().min(1, 'Title is required'),
  imageUrl: z.url('Image URL must be a valid URL'),
  targetUrl: z.string().optional(),
  targetType: z.enum(BannerType).optional(),
  targetId: z.string().optional(),
  isDeleted: z.boolean().optional().default(false),
  order: z.number().int().optional().default(0),
});

export const updateBannerValidation = createBannerValidation.partial();