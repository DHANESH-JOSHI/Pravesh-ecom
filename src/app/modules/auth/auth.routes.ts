import express from "express";
import { loginUser, registerUser, requestForOtp, verifyOtp } from "../auth/auth.controller";
import { authLimiter, smsLimiter } from "@/middlewares";

const router = express.Router();

router.post("/register", authLimiter, registerUser);

router.post("/login", authLimiter, loginUser);

router.post("/otp/request", smsLimiter, requestForOtp);

router.post("/otp/verify", authLimiter, verifyOtp);

export const authRouter = router;