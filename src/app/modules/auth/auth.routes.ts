import express from "express";
import { loginUser, logout, refreshTokens, registerUser, requestForOtp, loginUsingOtp, resetPassword, loginAsAdmin, loginAsAdminUsingOtp } from "../auth/auth.controller";
import { authLimiter, smsLimiter } from "@/middlewares";

const router = express.Router();

router.post("/register", authLimiter, registerUser);

router.post("/login", authLimiter, loginUser);

router.post("/admin-login", authLimiter, loginAsAdmin)

router.post("/otp/request", smsLimiter, requestForOtp);

router.post("/otp-login", authLimiter, loginUsingOtp);

router.post("/admin-otp-login", authLimiter, loginAsAdminUsingOtp)

router.post("/refresh-tokens", authLimiter, refreshTokens);

router.post("/logout", authLimiter, logout);

router.post('/password/reset', authLimiter, resetPassword);

export const authRouter = router;