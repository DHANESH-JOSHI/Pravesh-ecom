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
  updatePassword
} from "./user.controller";
import { auth, authenticatedActionLimiter, dataCheckLimiter } from "@/middlewares";

const router = express.Router();

router.get("/me", auth(), authenticatedActionLimiter, getMe);

router.get("/", auth('admin'), authenticatedActionLimiter, getAllUsers);

router.get("/:id", auth(), authenticatedActionLimiter, getUserById);

router.patch("/password", auth('user'), authenticatedActionLimiter,updatePassword);

router.post("/:id/recover", auth('admin'), authenticatedActionLimiter, recoverUser);

router.delete("/:id", auth('admin'), authenticatedActionLimiter, deleteUser);

router.post("/phone/:phone", dataCheckLimiter, checkPhoneExists);

router.post("/email/:email", dataCheckLimiter, checkEmailExists);

router.patch("/", auth('user'), authenticatedActionLimiter, updateUser);

export const userRouter = router;
