import { asyncHandler } from '@/utils';
import { RedisKeys } from '@/utils/redisKeys';
import { RedisPatterns } from '@/utils/redisKeys';
import { CacheTTL } from '@/utils/cacheTTL';
import { redis } from '@/config/redis';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import status from 'http-status';
import { Banner } from './banner.model';
import { createBannerValidation, updateBannerValidation } from './banner.validation';
import mongoose from 'mongoose';
import { cloudinary } from '@/config/cloudinary';

const ApiError = getApiErrorClass('BANNER');
const ApiResponse = getApiResponseClass('BANNER');

export const createBanner = asyncHandler(async (req, res) => {
  const bannerData = createBannerValidation.parse(req.body);
  bannerData.image = req.file?.path;
  const banner = await Banner.create(bannerData);
  await redis.deleteByPattern(RedisPatterns.BANNERS_ALL());
  res.status(status.CREATED).json(new ApiResponse(status.CREATED, 'Banner created successfully', banner));
  return;
});

export const getAllBanners = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, type, isDeleted } = req.query;

  const cacheKey = RedisKeys.BANNERS_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);

  if (cached)
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Successfully retrieved all banners", cached));

  const filter: any = {};
  if (type) filter.type = type;
  if (isDeleted !== undefined) filter.isDeleted = isDeleted === "true";
  else filter.isDeleted = false;

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');

    const searchCriteria = {
      title: { $regex: searchRegex }
    };

    const combinedMatch = {
      $and: [
        searchCriteria,
        filter
      ]
    };

    pipeline.push({ $match: combinedMatch });

  } else {
    pipeline.push({ $match: filter });
  }
  pipeline.push({ $sort: { order: 1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  const banners = await Banner.aggregate(pipeline);
  const total = await Banner.countDocuments(filter);
  const totalPages = Math.ceil(total / Number(limit));

  const result = {
    banners,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Successfully retrieved banners", result));
});

export const getBannerById = asyncHandler(async (req, res) => {
  const { id: bannerId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid banner ID');
  }
  const cacheKey = RedisKeys.BANNER_BY_ID(bannerId);
  const cachedBanner = await redis.get(cacheKey);

  if (cachedBanner) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'Banner retrieved successfully', cachedBanner));
  }

  const banner = await Banner.findOne({ _id: bannerId, isDeleted: false });
  if (!banner) {
    throw new ApiError(status.NOT_FOUND, 'Banner not found');
  }

  const bannerObj = (banner as any)?.toObject ? (banner as any).toObject() : banner;
  await redis.set(cacheKey, bannerObj, CacheTTL.LONG);

  res.status(status.OK).json(new ApiResponse(status.OK, `Successfully retrieved banner`, banner));
  return;
});

export const updateBanner = asyncHandler(async (req, res) => {
  const { id: bannerId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid banner ID');
  }
  const bannerData = updateBannerValidation.parse(req.body);

  const banner = await Banner.findOne({ _id: bannerId, isDeleted: false });
  if (!banner) {
    throw new ApiError(status.NOT_FOUND, 'Banner not found');
  }
  if (req.file) {
    bannerData.image = req.file.path;
    if (banner.image) {
      const publicId = banner.image.split("/").pop()?.split(".")[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`pravesh-banners/${publicId}`);
      }
    }
  }

  const updatedBanner = await Banner.findByIdAndUpdate(bannerId, bannerData, { new: true });

  await redis.deleteByPattern(RedisPatterns.BANNER_ANY(String(bannerId)));
  await redis.deleteByPattern(RedisPatterns.BANNERS_ALL());

  res.status(status.OK).json(new ApiResponse(status.OK, `Banner updated successfully`, updatedBanner));
  return;
});

export const deleteBanner = asyncHandler(async (req, res) => {
  const { id: bannerId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ApiError(status.BAD_REQUEST, 'The provided banner ID is not a valid format.');
  }
  const existingBanner = await Banner.findOne({ _id: bannerId, isDeleted: false });
  if (!existingBanner) {
    throw new ApiError(status.NOT_FOUND, 'Banner not found');
  }

  await Banner.findByIdAndUpdate(
    bannerId,
    { isDeleted: true },
    { new: true }
  );

  await redis.deleteByPattern(RedisPatterns.BANNER_ANY(String(bannerId)));
  await redis.deleteByPattern(RedisPatterns.BANNERS_ALL());

  res.status(status.OK).json(new ApiResponse(status.OK, `Banner has been deleted successfully`, existingBanner));
  return;
});