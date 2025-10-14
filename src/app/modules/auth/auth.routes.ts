import express from "express";
import {
  loginController,
  signUpController,
  getAllUsers,
  getUserById,
  resetPassword,
  activateUser,
  checkPhoneExists,
  checkEmailExists,
  updateUser,
  requestOtp,
  verifyOtp,
  getMe
} from "./auth.controller";
import { auth } from "@/middlewares";

const router = express.Router();

router.post("/signup", signUpController);

router.post("/signin", loginController);

router.get("/me", auth('user'), getMe);

router.get("/users", auth('admin'), getAllUsers);

router.get("/user/:id", auth(), getUserById);

router.post("/reset-password", auth('user'), resetPassword);

router.post("/activate-user", auth('admin'), activateUser);

router.post("/check-phone", checkPhoneExists);

router.post("/check-email", checkEmailExists);

router.patch("/user", auth('user'), updateUser);

router.post("/request-otp", requestOtp);

router.post("/verify-otp", verifyOtp);


export const authRouter = router;
