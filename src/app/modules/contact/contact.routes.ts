import express from "express";
import {
  createContact,
  listContacts,
  getContactById,
  resolveContact,
  deleteContact,
} from "./contact.controller";
import { auth, authenticatedActionLimiter } from "@/middlewares";

const router = express.Router();

router.post("/", createContact);

router.get("/", auth('admin'), authenticatedActionLimiter, listContacts);
router.get("/:id", auth('admin'), authenticatedActionLimiter, getContactById);
router.patch("/:id/resolve", auth('admin'), authenticatedActionLimiter, resolveContact);
router.delete("/:id", auth('admin'), authenticatedActionLimiter, deleteContact);

export const contactRouter = router;
