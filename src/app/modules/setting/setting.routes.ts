import express from "express";
import { getSettings, upsertSettings } from "./setting.controller";
import { auth, authenticatedActionLimiter, apiLimiter } from "@/middlewares";
import { upload } from "@/config/cloudinary";

const router = express.Router();

router.get("/", apiLimiter, getSettings);
router.patch("/", auth('admin'), authenticatedActionLimiter, upload.single("logo"), upsertSettings);

export const settingRouter = router; 