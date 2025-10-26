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
});

export const getActiveBanners = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('banners:active', req.query);
  const cachedBanners = await redis.get(cacheKey);

  if (cachedBanners) {
    return res.status(status.OK).json(new ApiResponse(status.OK, `Successfully retrieved active banners`, cachedBanners));
  }

  const banners = await Banner.find({ isDeleted: false }).sort({ order: 'asc' });
  await redis.set(cacheKey, banners, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, `Successfully retrieved ${banners.length} active banners`, banners));
});

export const getAllBanners = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('banners:all', req.query);
  const cachedBanners = await redis.get(cacheKey);

  if (cachedBanners) {
    return res.status(status.OK).json(new ApiResponse(status.OK, `Successfully retrieved all banners`, cachedBanners));
  }

  const banners = await Banner.find({}).sort({ order: 'asc' });
  await redis.set(cacheKey, banners, 3600);
  res.status(status.OK).json(new ApiResponse(status.OK, `Successfully retrieved all ${banners.length} banners`, banners));
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
});