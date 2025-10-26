import { validateIndianMobile } from "@/utils";
import { z } from "zod";
import { UserRole } from "./user.interface";
import { phoneOrEmailSchema } from "../auth/auth.validation";

export const resetPasswordValidation = z.object({
  phoneOrEmail: phoneOrEmailSchema,
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
  phone: z.string().refine(validateIndianMobile, {
    message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
  }).optional(),
  email: z.union([
    z.email("Invalid email format"),
    z.string().length(0)
  ]).optional(),
  img: z.string().optional(),
  role: z.enum(UserRole).optional(),
});

