import express from "express";
import {
  createAddress,
  deleteMyAddress,
  getAddressById,
  getAllAddresses,
  getMyAddresses,
  setDefaultAddress,
  updateMyAddress
} from "./address.controller";
import { auth, authenticatedActionLimiter } from "@/middlewares";

const router = express.Router();

router.get("/", auth('admin'), authenticatedActionLimiter, getAllAddresses);

router.get("/me", auth('user'), authenticatedActionLimiter, getMyAddresses);

router.get('/:id', auth(), authenticatedActionLimiter, getAddressById)

router.post("/", auth('user'), authenticatedActionLimiter, createAddress);

router.patch('/:id/default', auth('user'), authenticatedActionLimiter, setDefaultAddress);

router.patch("/:id", auth('user'), authenticatedActionLimiter, updateMyAddress);

router.delete("/:id", auth('user'), authenticatedActionLimiter, deleteMyAddress);

export const addressRouter = router;
