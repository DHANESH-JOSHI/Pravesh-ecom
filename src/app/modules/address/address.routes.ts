import express from "express";
import {
    createAddress,
    deleteMyAddress,
    getAllAddresses,
    getMyAddresses,
    updateMyAddress
} from "./address.controller";
import { auth } from "@/middlewares";

const router = express.Router();

router.get("/", auth('admin'), getAllAddresses);

router.use(auth('user'));

router.post("/", createAddress);

router.get("/me", getMyAddresses);

router.patch("/:id", updateMyAddress);

router.delete("/:id", deleteMyAddress);

export const addressRouter = router;
