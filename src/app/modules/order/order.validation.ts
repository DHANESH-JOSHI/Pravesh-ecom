import { z } from 'zod';
import { OrderStatus } from './order.interface';
import { Types } from "mongoose";

const objectIdValidation = z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), {
        message: 'Invalid ObjectId',
    }).transform((val) => new Types.ObjectId(val));

export const checkoutFromCartValidation = z.object({
    shippingAddressId: objectIdValidation,
});

export const adminUpdateOrderValidation = z.object({
    items: z.array(z.object({
        product: objectIdValidation,
        quantity: z.number().min(1, 'Quantity must be a positive number'),
    })).optional(),
    status: z.enum(OrderStatus).optional(),
    feedback: z.string().max(1000, 'Feedback too long').optional(),
});
