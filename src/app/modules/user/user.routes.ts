import express from "express";
import {
  getAllUsers,
  getUserById,
  recoverUser,
  checkPhoneExists,
  checkEmailExists,
  updateUser,
  deleteUser,
  getMe,
  updatePassword,
  createUser,
  resetPassword
} from "./user.controller";
import { auth, authenticatedActionLimiter, dataCheckLimiter } from "@/middlewares";
import { upload } from "@/config/cloudinary";

const router = express.Router();

router.get("/me", auth(), authenticatedActionLimiter, getMe);

router.post("/phone/:phone", dataCheckLimiter, checkPhoneExists);

router.post("/email/:email", dataCheckLimiter, checkEmailExists);

router.get("/", auth('admin'), authenticatedActionLimiter, getAllUsers);

router.post("/", auth('admin'), authenticatedActionLimiter, createUser);

router.get("/:id", auth(), authenticatedActionLimiter, getUserById);

router.post("/:id/recover", auth('admin'), authenticatedActionLimiter, recoverUser);

router.delete("/:id", auth('admin'), authenticatedActionLimiter, deleteUser);

router.patch("/password", auth('user'), authenticatedActionLimiter, updatePassword);

router.patch("/", auth('user'), authenticatedActionLimiter, upload.single('image'), updateUser);

router.post('/password/reset', auth('user'), authenticatedActionLimiter, resetPassword);

export const userRouter = router;
