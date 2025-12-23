import { z } from 'zod';
import { Types } from "mongoose";
// import { StockStatus } from './product.interface';

const objectIdValidation = z
  .string()
  .refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  }).transform((val) => new Types.ObjectId(val));

const createProductValidation = z.object({
  name: z.string().nonempty('Product name is required').max(200, 'Product name too long'),
  // description: z.string().optional(),
  // shortDescription: z.string().optional(),
  brandId: objectIdValidation.optional(),
  categoryId: objectIdValidation,


  // stock: z.coerce.number().min(0, 'Stock cannot be negative'),
  unit: z.string(),
  units: z.preprocess((val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return val; }
    }
    return val;
  }, z.array(z.object({
    unit: z.string().min(1, 'Unit name is required'),
    conversionRate: z.coerce.number().positive('Conversion rate must be positive'),
    isBase: z.boolean().optional(),
  })).optional()),
  // minStock: z.coerce.number().min(0).optional(),

  // features: z.preprocess((val) => {
  //   if (typeof val === 'string') {
  //     try { return JSON.parse(val); } catch (e) { return val; }
  //   }
  //   return val;
  // }, z.array(z.string()).optional()),
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
      try { return JSON.parse(val); } catch (e) { return val; }
    }
    return val;
  }, z.array(z.string()).optional()),
  // stockStatus: z.enum(StockStatus).optional(),
  isFeatured: z.coerce.boolean().optional(),
  isNewArrival: z.coerce.boolean().optional(),
  // 
  thumbnail: z.string().url('Thumbnail must be a valid URL').optional(),
});

const productsQueryValidation = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  categoryId: objectIdValidation.optional(),
  brandId: objectIdValidation.optional(),
  // stockStatus: z.enum(StockStatus).optional(),
  isFeatured: z.coerce.boolean().optional(),
  isNewArrival: z.coerce.boolean().optional(),
  // isDiscount: z.coerce.boolean().optional(),
  isDeleted: z.coerce.boolean().optional(),
  tags: z.string().optional(),
  rating: z.string().regex(/^[1-5]$/, 'Rating must be between 1-5').optional(),
  search: z.string().optional(),
});

export {
  createProductValidation,
  productsQueryValidation,
};
