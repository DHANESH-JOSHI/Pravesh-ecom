import express from "express";
import { getSettings, upsertSettings } from "./setting.controller";
import { auth, authenticatedActionLimiter } from "@/middlewares";

const router = express.Router();

router.get("/", getSettings);
router.patch("/", auth('admin'), authenticatedActionLimiter, upsertSettings);

export const settingRouter = router;
