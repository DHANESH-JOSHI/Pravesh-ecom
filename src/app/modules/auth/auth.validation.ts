import { z } from "zod";

// Regex for Indian mobile numbers
// Must start with 6, 7, 8, or 9 and be followed by 9 digits
const indianMobileRegex = /^[6-9]\d{9}$/;

// Function to validate and format Indian mobile number
const validateIndianMobile = (phone: string) => {
  // Remove country code +91 or 0 prefix if present
  let cleanedPhone = phone.replace(/^(\+91|0)/, '').trim();
  
  if (!indianMobileRegex.test(cleanedPhone)) {
    throw new Error("Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9");
  }
  
  return cleanedPhone;
};



export const authValidation = z.object({
  name: z.string(),
  password: z.string().min(6),
  phone: z.string().refine(validateIndianMobile, {
    message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
  }),
  email: z.string().email("Invalid email format"),
  img: z.string().optional(),
  role: z.enum(['admin','vendor', 'user']).default('user').optional()
});

export const loginValidation = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string()
});

export const resetPasswordValidation = z.object({
  phone: z.string().refine(validateIndianMobile, {
    message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
  }),
  newPassword: z.string().min(6)
});

export const activateUserValidation = z.object({
  phone: z.string().refine(validateIndianMobile, {
    message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
  })
});

export const phoneCheckValidation = z.object({
  phone: z.string().refine(validateIndianMobile, {
    message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
  })
});

export const emailCheckValidation = z.object({
  email: z.string().email("Invalid email format")
});

export const updateUserValidation = z.object({
  name: z.string().optional(),
  phone: z.string().refine(validateIndianMobile, {
    message: "Invalid Indian mobile number. Must be 10 digits starting with 6, 7, 8, or 9"
  }).optional(),
  email: z.union([
    z.string().email("Invalid email format"),
    z.string().length(0) // Allow empty string
  ]).optional(),
  img: z.string().optional(),
  role: z.enum(['admin','vendor', 'user']).optional(),
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

