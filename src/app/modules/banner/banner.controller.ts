import { asyncHandler, generateCacheKey } from '@/utils';
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
  await redis.deleteByPattern('banners*');
  res.status(status.CREATED).json(new ApiResponse(status.CREATED, 'Banner created successfully', banner));
  return;
});

export const getAllBanners = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, type, isDeleted } = req.query;
  const cacheKey = generateCacheKey('banners:all', req.query);
  const cachedBanners = await redis.get(cacheKey);

  if (cachedBanners) {
    return res.status(status.OK).json(new ApiResponse(status.OK, `Successfully retrieved all banners`, cachedBanners));
  }

  const filter: any = {};
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (type) filter.type = type;
  if (isDeleted !== undefined) {
    filter.isDeleted = isDeleted === 'true';
  } else {
    filter.isDeleted = false;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [banners, total] = await Promise.all([
    Banner.find(filter).sort({ order: 'asc' }).skip(skip).limit(Number(limit)),
    Banner.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    banners,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, `Successfully retrieved banners`, result));
  return;
});

export const updateBanner = asyncHandler(async (req, res) => {
  const { id: bannerId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid banner ID');
  }
  const bannerData = updateBannerValidation.parse(req.body);

  const banner = await Banner.findById(bannerId);
  if (!banner) {
    throw new ApiError(status.NOT_FOUND, 'Banner not found');
  }
  if (banner.isDeleted) {
    throw new ApiError(status.BAD_REQUEST, 'Cannot update a deleted banner');
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

  await redis.deleteByPattern('banners*');

  res.status(status.OK).json(new ApiResponse(status.OK, `Banner updated successfully`, updatedBanner));
  return;
});

export const deleteBanner = asyncHandler(async (req, res) => {
  const { id: bannerId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw new ApiError(status.BAD_REQUEST, 'The provided banner ID is not a valid format.');
  }
  const existingBanner = await Banner.findById(bannerId);
  if (!existingBanner) {
    throw new ApiError(status.NOT_FOUND, 'Banner not found');
  }
  if (existingBanner.isDeleted) {
    throw new ApiError(status.BAD_REQUEST, 'Banner is already deleted');
  }

  await Banner.findByIdAndUpdate(
    bannerId,
    { isDeleted: true },
    { new: true }
  );

  await redis.deleteByPattern('banners*');

  res.status(status.OK).json(new ApiResponse(status.OK, `Banner has been deleted successfully`, existingBanner));
  return;
});