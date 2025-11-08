import { validateIndianMobile } from "@/utils";
import { z } from "zod";

export const resetPasswordValidation = z.object({
  otp: z
    .string()
    .trim()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
  newPassword: z.string().min(6)
});

export const updatePasswordValidation = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6)
});

export const phoneCheckValidation = z.object({
  phone: z.string().refine(validateIndianMobile, {
    message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
  })
});

export const emailCheckValidation = z.object({
  email: z.email("Invalid email format")
});

export const updateUserValidation = z.object({
  name: z.string().optional(),
  email: z.union([
    z.email("Invalid email format"),
    z.string().length(0)
  ]).optional(),
  img: z.string().optional(),
});

