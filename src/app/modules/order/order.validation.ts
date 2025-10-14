import { z } from 'zod';
import { OrderStatus } from './order.interface';

export const checkoutFromCartValidation = z.object({
    shippingAddress: z.object({
        street: z.string().min(1, 'Street is required'),
        city: z.string().min(1, 'City is required'),
        state: z.string().min(1, 'State is required'),
        postalCode: z.string().min(1, 'Postal code is required'),
        country: z.string().min(1, 'Country is required'),
    }),
});

export const adminUpdateOrderValidation = z.object({
    items:z.array(z.object({
        product: z.string().min(1, 'Product ID is required'),
        quantity: z.number().min(1, 'Quantity must be a positive number'),
        price: z.number().min(0, 'Price must be a positive number'),
        selectedColor: z.string().optional(),
        selectedSize: z.string().optional(),
    })).optional(),
    shippingAddress: z.object({
        street: z.string().min(1, 'Street is required'),
        city: z.string().min(1, 'City is required'),
        state: z.string().min(1, 'State is required'),
        postalCode: z.string().min(1, 'Postal code is required'),
        country: z.string().min(1, 'Country is required'),
    }).optional(),
    status: z.enum(OrderStatus).optional(),
    feedback: z.string().max(1000, 'Feedback too long').optional(),
});
