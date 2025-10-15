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
import { auth } from "@/middlewares";

const router = express.Router();

router.get("/me", auth('user'), getMe);

router.get("/", auth('admin'), getAllUsers);

router.get("/:id", auth(), getUserById);

router.post("/reset-password", auth('user'), resetPassword);

router.post("/:id/activate", auth('admin'), activateUser);

router.post("/phone/:phone", checkPhoneExists);

router.post("/email/:email", checkEmailExists);

router.patch("/", auth('user'), updateUser);

export const userRouter = router;
