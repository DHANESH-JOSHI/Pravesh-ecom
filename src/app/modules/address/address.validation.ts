import { z } from 'zod';

const AddressValidation = z.object({
    fullname: z.string().nonempty('Full name is required').max(100, 'Full name too long'),
    phone: z.string().nonempty('Phone number is required').max(20, 'Phone number too long'),
    line1: z.string().nonempty('Address line 1 is required').max(200, 'Address line 1 too long'),
    line2: z.string().max(200, 'Address line 2 too long').optional(),
    landmark: z.string().max(100, 'Landmark too long').optional(),
    city: z.string().nonempty('City is required').max(100, 'City name too long'),
    state: z.string().nonempty('State is required').max(100, 'State name too long'),
    postalCode: z.string().nonempty('Postal code is required').max(20, 'Postal code too long'),
    country: z.string().nonempty('Country is required').max(100, 'Country name too long'),
});

export {
    AddressValidation,
};