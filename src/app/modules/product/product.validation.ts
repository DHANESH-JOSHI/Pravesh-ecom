import { z } from 'zod';
import { Types } from "mongoose";
import { DiscountType, ProductStatus, StockStatus, UnitType } from './product.interface';

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
  brandId: objectIdValidation.optional(),
  categoryId: objectIdValidation,

  thumbnail: z.url().optional(),
  images: z.array(z.string()).optional(),

  originalPrice: z.coerce.number().min(0, 'Base price must be positive'),
  discountValue: z.coerce.number().min(0, 'Discount cannot be negative').default(0),
  discountType: z.enum(DiscountType).default(DiscountType.Percentage),
  finalPrice: z.coerce.number().min(0).optional(),

  stock: z.coerce.number().min(0, 'Stock cannot be negative'),
  unit: z.enum(UnitType),
  minStock: z.coerce.number().min(0).optional(),

  features: z.preprocess((val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return val; }
    }
    return val;
  }, z.array(z.string()).optional()),
  specifications: z.preprocess((val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return val; }
    }
    return val;
  }, z.record(z.string(), z.any()).refine(val => typeof val === 'object' && val !== null, {
    message: "Specifications must be a valid JSON object string.",
  }).optional()),

  tags: z.preprocess((val) => {
    if (typeof val === 'string') {
      return val.split(',').map(item => item.trim());
    }
    return val;
  }, z.array(z.string()).optional()),
  stockStatus: z.enum(StockStatus).optional(),
  isFeatured: z.coerce.boolean().optional(),
  isNewArrival: z.coerce.boolean().optional(),
});

const productsQueryValidation = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  categoryId: objectIdValidation.optional(),
  brandId: objectIdValidation.optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  status: z.enum(ProductStatus).optional(),
  stockStatus: z.enum(StockStatus).optional(),
  isFeatured: z.coerce.boolean().optional(),
  isNewArrival: z.coerce.boolean().optional(),
  isDiscount: z.coerce.boolean().optional(),
  isDeleted: z.coerce.boolean().optional(),
  tags: z.string().optional(),
  rating: z.string().regex(/^[1-5]$/, 'Rating must be between 1-5').optional(),
  search: z.string().optional(),
});

export {
  createProductValidation,
  productsQueryValidation,
};
