import express from "express";
import { loginUser, registerUser, requestForOtp, verifyOtp } from "../auth/auth.controller";

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/otp/request", requestForOtp);

router.post("/otp/verify", verifyOtp);

export const authRouter = router;