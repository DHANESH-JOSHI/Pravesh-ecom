import express from "express";
import { loginUser, logout, refreshTokens, registerUser, requestForOtp, loginUsingOtp, loginAsAdmin, loginAsAdminUsingOtp } from "../auth/auth.controller";
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

export const authRouter = router;