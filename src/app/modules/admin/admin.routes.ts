import express from "express";
import { auth, authenticatedActionLimiter } from "@/middlewares";
import {
  createStaff,
  getAllStaff,
  updateStaff,
  deleteStaff,
} from "./admin.controller";

const router = express.Router();

// All routes require admin role
router.post("/staff", auth("admin"), authenticatedActionLimiter, createStaff);
router.get("/staff", auth("admin"), authenticatedActionLimiter, getAllStaff);
router.patch("/staff/:id", auth("admin"), authenticatedActionLimiter, updateStaff);
router.delete("/staff/:id", auth("admin"), authenticatedActionLimiter, deleteStaff);

export const adminRouter = router;

