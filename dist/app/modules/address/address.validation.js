"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressValidation = void 0;
const zod_1 = require("zod");
const AddressValidation = zod_1.z.object({
    fullname: zod_1.z.string().nonempty('Full name is required').max(100, 'Full name too long'),
    phone: zod_1.z.string().nonempty('Phone number is required').max(20, 'Phone number too long'),
    line1: zod_1.z.string().nonempty('Address line 1 is required').max(200, 'Address line 1 too long'),
    line2: zod_1.z.string().max(200, 'Address line 2 too long').optional(),
    landmark: zod_1.z.string().max(100, 'Landmark too long').optional(),
    city: zod_1.z.string().nonempty('City is required').max(100, 'City name too long'),
    state: zod_1.z.string().nonempty('State is required').max(100, 'State name too long'),
    postalCode: zod_1.z.string().nonempty('Postal code is required').max(20, 'Postal code too long'),
    country: zod_1.z.string().nonempty('Country is required').max(100, 'Country name too long'),
});
exports.AddressValidation = AddressValidation;
//# sourceMappingURL=address.validation.js.map