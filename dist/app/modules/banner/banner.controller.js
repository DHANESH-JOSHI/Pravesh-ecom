"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBanner = exports.updateBanner = exports.getBannerById = exports.getAllBanners = exports.createBanner = void 0;
const utils_1 = require("../../utils");
const redis_1 = require("../../config/redis");
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const banner_model_1 = require("./banner.model");
const banner_validation_1 = require("./banner.validation");
const mongoose_1 = __importDefault(require("mongoose"));
const cloudinary_1 = require("../../config/cloudinary");
const ApiError = (0, interface_1.getApiErrorClass)('BANNER');
const ApiResponse = (0, interface_1.getApiResponseClass)('BANNER');
exports.createBanner = (0, utils_1.asyncHandler)(async (req, res) => {
    const bannerData = banner_validation_1.createBannerValidation.parse(req.body);
    bannerData.image = req.file?.path;
    const banner = await banner_model_1.Banner.create(bannerData);
    await redis_1.redis.deleteByPattern('banners*');
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, 'Banner created successfully', banner));
    return;
});
exports.getAllBanners = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, search, type, isDeleted } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)('banners', req.query);
    const cachedBanners = await redis_1.redis.get(cacheKey);
    if (cachedBanners) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, `Successfully retrieved all banners`, cachedBanners));
    }
    const filter = {};
    if (search)
        filter.$text = { $search: search };
    if (type)
        filter.type = type;
    if (isDeleted !== undefined) {
        filter.isDeleted = isDeleted === 'true';
    }
    else {
        filter.isDeleted = false;
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [banners, total] = await Promise.all([
        banner_model_1.Banner.find(filter).sort({ order: 'asc' }).skip(skip).limit(Number(limit)),
        banner_model_1.Banner.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        banners,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, `Successfully retrieved banners`, result));
    return;
});
exports.getBannerById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id: bannerId } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(bannerId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid banner ID');
    }
    const banner = await banner_model_1.Banner.findById(bannerId);
    if (!banner || banner.isDeleted) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Banner not found');
    }
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, `Successfully retrieved banner`, banner));
    return;
});
exports.updateBanner = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id: bannerId } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(bannerId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid banner ID');
    }
    const bannerData = banner_validation_1.updateBannerValidation.parse(req.body);
    const banner = await banner_model_1.Banner.findById(bannerId);
    if (!banner) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Banner not found');
    }
    if (banner.isDeleted) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Cannot update a deleted banner');
    }
    if (req.file) {
        bannerData.image = req.file.path;
        if (banner.image) {
            const publicId = banner.image.split("/").pop()?.split(".")[0];
            if (publicId) {
                await cloudinary_1.cloudinary.uploader.destroy(`pravesh-banners/${publicId}`);
            }
        }
    }
    const updatedBanner = await banner_model_1.Banner.findByIdAndUpdate(bannerId, bannerData, { new: true });
    await redis_1.redis.deleteByPattern('banners*');
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, `Banner updated successfully`, updatedBanner));
    return;
});
exports.deleteBanner = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id: bannerId } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(bannerId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'The provided banner ID is not a valid format.');
    }
    const existingBanner = await banner_model_1.Banner.findById(bannerId);
    if (!existingBanner) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Banner not found');
    }
    if (existingBanner.isDeleted) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Banner is already deleted');
    }
    await banner_model_1.Banner.findByIdAndUpdate(bannerId, { isDeleted: true }, { new: true });
    await redis_1.redis.deleteByPattern('banners*');
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, `Banner has been deleted successfully`, existingBanner));
    return;
});
//# sourceMappingURL=banner.controller.js.map