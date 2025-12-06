import { asyncHandler } from "@/utils";
import { Setting } from "./setting.model";
import { settingValidation } from "./setting.validation";
import { getApiResponseClass } from "@/interface";
import status from "http-status";
import { cloudinary } from "@/config/cloudinary";

const ApiResponse = getApiResponseClass("SETTING");

export const getSettings = asyncHandler(async (_, res) => {
  const setting = await Setting.findOne().lean();
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

  res.status(status.OK).json(new ApiResponse(status.OK, "Settings saved successfully", setting));
  return;
});
