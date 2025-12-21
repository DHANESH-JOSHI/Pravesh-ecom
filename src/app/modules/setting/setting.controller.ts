import { asyncHandler } from "@/utils";
import { Setting } from "./setting.model";
import { settingValidation } from "./setting.validation";
import { getApiResponseClass } from "@/interface";
import status from "http-status";
import { cloudinary } from "@/config/cloudinary";
import { redis } from "@/config/redis";
import { RedisKeys } from "@/utils/redisKeys";
import { CacheTTL } from "@/utils/cacheTTL";
import { RedisPatterns } from "@/utils/redisKeys";

const ApiResponse = getApiResponseClass("SETTING");

export const getSettings = asyncHandler(async (_, res) => {
  const cacheKey = RedisKeys.SETTINGS_LIST();
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.status(status.OK).json(new ApiResponse(status.OK, "Settings retrieved successfully", cached));
    return;
  }
  const setting = await Setting.findOne().lean();
  await redis.set(cacheKey, setting || {}, CacheTTL.XLONG);
  res.status(status.OK).json(new ApiResponse(status.OK, "Settings retrieved successfully", setting || {}));
  return;
});

export const upsertSettings = asyncHandler(async (req, res) => {
  const payload = settingValidation.parse(req.body);
  let setting = await Setting.findOne().select('logo');
  if (req.file) {
    payload.logo = req.file.path;
    if (setting?.logo) {
      const publicId = setting.logo.split('/').pop()?.split('.')[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`pravesh-logo/${publicId}`);
      }
    }
  }
  if (!setting) {
    setting = await Setting.create(payload);
  } else {
    Object.assign(setting, payload);
    await setting.save();
  }

  await redis.delete(RedisKeys.SETTINGS_LIST());

  res.status(status.OK).json(new ApiResponse(status.OK, "Settings saved successfully", setting));
  return;
});
