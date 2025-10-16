import express from "express";
import {
  getAllUsers,
  getUserById,
  resetPassword,
  activateUser,
  checkPhoneExists,
  checkEmailExists,
  updateUser,
  getMe
} from "./user.controller";
import { auth, authenticatedActionLimiter, dataCheckLimiter, emailLimiter } from "@/middlewares";

const router = express.Router();

router.get("/me", auth('user'), authenticatedActionLimiter, getMe);

router.get("/", auth('admin'), authenticatedActionLimiter, getAllUsers);

router.get("/:id", auth(), authenticatedActionLimiter, getUserById);

router.post("/reset-password", auth('user'), emailLimiter, resetPassword);

router.post("/:id/activate", auth('admin'), authenticatedActionLimiter, activateUser);

router.post("/phone/:phone", dataCheckLimiter, checkPhoneExists);

router.post("/email/:email", dataCheckLimiter, checkEmailExists);

router.patch("/", auth('user'), authenticatedActionLimiter, updateUser);

export const userRouter = router;
