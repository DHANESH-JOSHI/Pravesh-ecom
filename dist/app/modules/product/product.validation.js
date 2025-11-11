"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productsQueryValidation = exports.createProductValidation = void 0;
const zod_1 = require("zod");
const mongoose_1 = require("mongoose");
// import { StockStatus } from './product.interface';
const objectIdValidation = zod_1.z
    .string()
    .refine((val) => mongoose_1.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
}).transform((val) => new mongoose_1.Types.ObjectId(val));
const createProductValidation = zod_1.z.object({
    name: zod_1.z.string().nonempty('Product name is required').max(200, 'Product name too long'),
    slug: zod_1.z.string().optional(),
    // description: z.string().optional(),
    // shortDescription: z.string().optional(),
    brandId: objectIdValidation.optional(),
    categoryId: objectIdValidation,
    originalPrice: zod_1.z.coerce.number().min(0, 'Base price must be positive'),
    // discountValue: z.coerce.number().min(0, 'Discount cannot be negative').default(0),
    // discountType: z.enum(DiscountType).default(DiscountType.Percentage),
    // finalPrice: z.coerce.number().min(0).optional(),
    // stock: z.coerce.number().min(0, 'Stock cannot be negative'),
    unit: zod_1.z.string(),
    // minStock: z.coerce.number().min(0).optional(),
    // features: z.preprocess((val) => {
    //   if (typeof val === 'string') {
    //     try { return JSON.parse(val); } catch (e) { return val; }
    //   }
    //   return val;
    // }, z.array(z.string()).optional()),
    specifications: zod_1.z.preprocess((val) => {
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            }
            catch (e) {
                return val;
            }
        }
        return val;
    }, zod_1.z.record(zod_1.z.string(), zod_1.z.any()).refine(val => typeof val === 'object' && val !== null, {
        message: "Specifications must be a valid JSON object string.",
    }).optional()),
    tags: zod_1.z.preprocess((val) => {
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            }
            catch (e) {
                return val;
            }
        }
        return val;
    }, zod_1.z.array(zod_1.z.string()).optional()),
    // stockStatus: z.enum(StockStatus).optional(),
    isFeatured: zod_1.z.coerce.boolean().optional(),
    isNewArrival: zod_1.z.coerce.boolean().optional(),
});
exports.createProductValidation = createProductValidation;
const productsQueryValidation = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional(),
    limit: zod_1.z.coerce.number().int().positive().optional(),
    sort: zod_1.z.string().optional(),
    order: zod_1.z.enum(['asc', 'desc']).optional(),
    categoryId: objectIdValidation.optional(),
    brandId: objectIdValidation.optional(),
    minPrice: zod_1.z.coerce.number().min(0).optional(),
    maxPrice: zod_1.z.coerce.number().min(0).optional(),
    // stockStatus: z.enum(StockStatus).optional(),
    isFeatured: zod_1.z.coerce.boolean().optional(),
    isNewArrival: zod_1.z.coerce.boolean().optional(),
    // isDiscount: z.coerce.boolean().optional(),
    isDeleted: zod_1.z.coerce.boolean().optional(),
    tags: zod_1.z.string().optional(),
    rating: zod_1.z.string().regex(/^[1-5]$/, 'Rating must be between 1-5').optional(),
    search: zod_1.z.string().optional(),
});
exports.productsQueryValidation = productsQueryValidation;
//# sourceMappingURL=product.validation.js.map