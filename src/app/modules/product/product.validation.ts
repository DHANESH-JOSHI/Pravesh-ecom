import { z } from 'zod';
import { Types } from "mongoose";
import { ProductStatus, StockStatus } from './product.interface';

const objectIdValidation = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  }).transform((val) => new Types.ObjectId(val));

const createProductValidation = z.object({
  name: z.string().nonempty('Product name is required').max(200, 'Product name too long'),
  slug: z.string().optional(),
  sku: z.string().nonempty('SKU is required'),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  brand: objectIdValidation.optional(),
  category: objectIdValidation,

  originalPrice: z.number().min(0, 'Base price must be positive'),
  discountValue: z.number().min(0, 'Discount cannot be negative').default(0),
  discountType: z.enum(['percentage', 'fixed']).default('percentage'),
  finalPrice: z.number().min(0).optional(),

  thumbnail: z.url().optional(),
  images: z.array(z.string().nonempty('Image URL cannot be empty')).optional(),

  stock: z.number().min(0, 'Stock cannot be negative'),
  unit: z.enum(['bag', 'piece', 'kg', 'ton', 'litre', 'bundle', 'meter']),
  minStock: z.number().min(0).optional(),

  features: z.preprocess((val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return val; }
    }
    return val;
  }, z.record(z.any(), z.any()).optional()),
  specifications: z.preprocess((val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return val; }
    }
    return val;
  }, z.record(z.string(), z.any()).optional()),

  tags: z.array(z.string()).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.array(z.string()).optional(),

  shippingInfo: z.preprocess((val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return val; }
    }
    return val;
  }, z.record(z.string(), z.any()).optional()),

  stockStatus: z.enum(StockStatus).optional(),
  isFeatured: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  isDiscount: z.boolean().optional(),
  isDeleted: z.boolean().optional(),

  rating: z.number().min(0).optional(),
  reviewCount: z.number().min(0).optional(),
});

const productsQueryValidation = z.object({
  page: z.string().regex(/^\d+$/, 'Page must be a number').optional(),
  limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  category: objectIdValidation.optional(),
  brand: objectIdValidation.optional(),
  minPrice: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid minimum price').optional(),
  maxPrice: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid maximum price').optional(),
  inStock: z.string().regex(/^(true|false)$/, 'Invalid stock filter').optional(),
  status: z.enum(ProductStatus).optional(),
  stockStatus: z.enum(StockStatus).optional(),
  isFeatured: z.string().regex(/^(true|false)$/, 'Invalid featured filter').optional(),
  isNewArrival: z.string().regex(/^(true|false)$/, 'Invalid new arrival filter').optional(),
  isDiscount: z.string().regex(/^(true|false)$/, 'Invalid discount filter').optional(),
  isDeleted: z.string().regex(/^(true|false)$/, 'Invalid deleted filter').optional(),
  tags: z.string().optional(),
  rating: z.string().regex(/^[1-5]$/, 'Rating must be between 1-5').optional(),
  search: z.string().optional(),
});

export {
  createProductValidation,
  productsQueryValidation,
};
