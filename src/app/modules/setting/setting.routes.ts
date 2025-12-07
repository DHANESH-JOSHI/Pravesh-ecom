import express from "express";
import { getSettings, upsertSettings } from "./setting.controller";
import { auth, authenticatedActionLimiter } from "@/middlewares";
import { upload } from "@/config/cloudinary";

const router = express.Router();

router.get("/", getSettings);
router.patch("/", auth('admin'), authenticatedActionLimiter, upload.single("logo"), upsertSettings);

export const settingRouter = router; 