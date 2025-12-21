"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertSettings = exports.getSettings = void 0;
const utils_1 = require("../../utils");
const setting_model_1 = require("./setting.model");
const setting_validation_1 = require("./setting.validation");
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const cloudinary_1 = require("../../config/cloudinary");
const redis_1 = require("../../config/redis");
const redisKeys_1 = require("../../utils/redisKeys");
const cacheTTL_1 = require("../../utils/cacheTTL");
const ApiResponse = (0, interface_1.getApiResponseClass)("SETTING");
exports.getSettings = (0, utils_1.asyncHandler)(async (_, res) => {
    const cacheKey = redisKeys_1.RedisKeys.SETTINGS_LIST();
    const cached = await redis_1.redis.get(cacheKey);
    if (cached) {
        res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Settings retrieved successfully", cached));
        return;
    }
    const setting = await setting_model_1.Setting.findOne().lean();
    await redis_1.redis.set(cacheKey, setting || {}, cacheTTL_1.CacheTTL.XLONG);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Settings retrieved successfully", setting || {}));
    return;
});
exports.upsertSettings = (0, utils_1.asyncHandler)(async (req, res) => {
    const payload = setting_validation_1.settingValidation.parse(req.body);
    let setting = await setting_model_1.Setting.findOne().select('logo');
    if (req.file) {
        payload.logo = req.file.path;
        if (setting?.logo) {
            const publicId = setting.logo.split('/').pop()?.split('.')[0];
            if (publicId) {
                await cloudinary_1.cloudinary.uploader.destroy(`pravesh-logo/${publicId}`);
            }
        }
    }
    if (!setting) {
        setting = await setting_model_1.Setting.create(payload);
    }
    else {
        Object.assign(setting, payload);
        await setting.save();
    }
    await redis_1.redis.delete(redisKeys_1.RedisKeys.SETTINGS_LIST());
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Settings saved successfully", setting));
    return;
});
//# sourceMappingURL=setting.controller.js.map