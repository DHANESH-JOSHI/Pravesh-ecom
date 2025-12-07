import express from "express";
import {
  createMessage,
  listMessages,
  getMessageById,
  resolveMessage,
  deleteMessage,
} from "./message.controller";
import { auth, authenticatedActionLimiter } from "@/middlewares";

const router = express.Router();

router.post("/", createMessage);

router.get("/", auth('admin'), authenticatedActionLimiter, listMessages);
router.get("/:id", auth('admin'), authenticatedActionLimiter, getMessageById);
router.patch("/:id/resolve", auth('admin'), authenticatedActionLimiter, resolveMessage);
router.delete("/:id", auth('admin'), authenticatedActionLimiter, deleteMessage);

export const messageRouter = router;
