"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingValidation = void 0;
const zod_1 = require("zod");
const parseJsonIfString = (schema) => zod_1.z.preprocess((val) => {
    if (typeof val === "string") {
        try {
            return JSON.parse(val);
        }
        catch {
            return val;
        }
    }
    return val;
}, schema);
exports.settingValidation = zod_1.z.object({
    businessName: zod_1.z.string().max(200).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    logo: zod_1.z.string().optional(),
    socialLinks: parseJsonIfString(zod_1.z.object({
        facebook: zod_1.z.string().url().optional(),
        twitter: zod_1.z.string().url().optional(),
        instagram: zod_1.z.string().url().optional(),
        linkedin: zod_1.z.string().url().optional(),
        youtube: zod_1.z.string().url().optional(),
    }).optional()).optional(),
    aboutTitle: zod_1.z.string().max(300).optional(),
    aboutDescription: zod_1.z.string().optional(),
    whyChooseUs: zod_1.z.string().optional(),
    workingHours: zod_1.z.string().optional(),
    yearsOfExperience: zod_1.z.string().optional(),
    happyCustomers: zod_1.z.string().optional(),
    productsAvailable: zod_1.z.string().optional(),
    citiesServed: zod_1.z.string().optional(),
});
//# sourceMappingURL=setting.validation.js.map