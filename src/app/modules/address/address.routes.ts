import express from "express";
import {
  createAddress,
  deleteMyAddress,
  getAllAddresses,
  getMyAddresses,
  setDefaultAddress,
  updateMyAddress
} from "./address.controller";
import { auth, authenticatedActionLimiter } from "@/middlewares";

const router = express.Router();

router.get("/", auth('admin'), getAllAddresses);

router.use(auth('user'));

router.get("/me", getMyAddresses);

router.post("/", authenticatedActionLimiter, createAddress);

router.patch('/:id/default', authenticatedActionLimiter, setDefaultAddress);

router.patch("/:id", authenticatedActionLimiter, updateMyAddress);

router.delete("/:id", authenticatedActionLimiter, deleteMyAddress);

export const addressRouter = router;
