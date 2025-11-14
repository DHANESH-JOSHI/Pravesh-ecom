import z from "zod";
import { validateIndianMobile } from "@/utils";

export const phoneOrEmailSchema = z
  .string()
  .trim()
  .refine(
    (val) => z.email().safeParse(val).success || validateIndianMobile(val),
    {
      message: "Must be a valid Indian mobile number or a valid email address",
    }
  );

export const registerValidation = z.object({
  name: z.string(),
  password: z.string().min(6),
  phone: z.string().refine(validateIndianMobile, {
    message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
  }),
  email: z.email("Invalid email format").optional(),
});

export const loginValidation = z.object({
  phoneOrEmail: phoneOrEmailSchema,
  password: z.string()
});

export const requestOtpValidation = z.object({
  phoneOrEmail: phoneOrEmailSchema,
});

export const verifyOtpValidation = z.object({
  phoneOrEmail: phoneOrEmailSchema,
  otp: z
    .string()
    .trim()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
});
