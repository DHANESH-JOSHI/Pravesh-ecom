import z from "zod";
import { validateIndianMobile } from "@/utils";

export const registerValidation = z.object({
    name: z.string(),
    password: z.string().min(6),
    phone: z.string().refine(validateIndianMobile, {
        message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
    }),
    email: z.email("Invalid email format"),
    img: z.string().optional(),
    role: z.enum(['admin', 'vendor', 'user']).default('user').optional()
});

export const loginValidation = z.object({
    email: z.email("Invalid email format"),
    password: z.string()
});

export const requestOtpValidation = z.object({
    phone: z.string().refine(validateIndianMobile, {
        message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
    })
});

export const verifyOtpValidation = z.object({
    phone: z.string().refine(validateIndianMobile, {
        message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
    }),
    otp: z.string().length(4, "OTP must be 4 digits")
});