import express from "express";
import { loginUser, logout, refreshTokens, registerUser, requestForOtp, loginUsingOtp, loginAsAdmin, loginAsAdminUsingOtp } from "../auth/auth.controller";
import { authLimiter, smsLimiter, tokenLimiter, apiLimiter } from "@/middlewares";

const router = express.Router();

// Authentication endpoints - strict limits to prevent brute force
router.post("/register", apiLimiter, authLimiter, registerUser);
router.post("/login", apiLimiter, authLimiter, loginUser);
router.post("/admin-login", apiLimiter, authLimiter, loginAsAdmin);
router.post("/otp-login", apiLimiter, authLimiter, loginUsingOtp);
router.post("/admin-otp-login", apiLimiter, authLimiter, loginAsAdminUsingOtp);

// OTP request - SMS limiter (expensive)
router.post("/otp/request", apiLimiter, smsLimiter, requestForOtp);

// Token/session endpoints - more lenient limits
router.post("/refresh-tokens", apiLimiter, tokenLimiter, refreshTokens);
router.post("/logout", apiLimiter, tokenLimiter, logout);

export const authRouter = router;