import { z } from "zod";

const parseJsonIfString = (schema: z.ZodTypeAny) =>
  z.preprocess((val) => {
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }, schema);

const urlOrString = z.union([z.string().url(), z.string()]).optional();

export const settingValidation = z.object({
  businessName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  logo: parseJsonIfString(urlOrString),
  socialLinks: parseJsonIfString(z.object({
    facebook: z.string().url().optional(),
    twitter: z.string().url().optional(),
    instagram: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    youtube: z.string().url().optional(),
  }).optional()).optional(),
  aboutTitle: z.string().max(300).optional(),
  aboutDescription: z.string().optional(),
  whyChooseUs: z.string().optional(),
  yearsOfExperience: z.string().optional(),
  happyCustomers: z.string().optional(),
  productsAvailable: z.string().optional(),
  citiesServed: z.string().optional(),
});
