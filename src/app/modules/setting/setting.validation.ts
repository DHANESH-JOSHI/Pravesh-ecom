import { z } from "zod";

const parseJsonIfString = (schema: z.ZodTypeAny) =>
  z.preprocess((val) => {
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }, schema);
export const settingValidation = z.object({
  businessName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  logo: z.string().optional(),
  socialLinks: parseJsonIfString(z.object({
    facebook: z.string().optional(),
    twitter: z.string().optional(),
    instagram: z.string().optional(),
    linkedin: z.string().optional(),
    youtube: z.string().optional(),
  }).optional()).optional(),
  aboutTitle: z.string().max(300).optional(),
  aboutDescription: z.string().optional(),
  whyChooseUs: z.string().optional(),
  workingHours: z.string().optional(),
  yearsOfExperience: z.string().optional(),
  happyCustomers: z.string().optional(),
  productsAvailable: z.string().optional(),
  citiesServed: z.string().optional(),
});
