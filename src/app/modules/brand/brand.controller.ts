import { redis } from "@/config/redis";
import { Brand } from "./brand.model";
import { brandValidation, brandUpdateValidation } from "./brand.validation";
import { cloudinary } from "@/config/cloudinary";
import { asyncHandler, generateCacheKey } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import mongoose from "mongoose";
import status from "http-status";
const ApiError = getApiErrorClass("BRAND");
const ApiResponse = getApiResponseClass("BRAND");

export const createBrand = asyncHandler(async (req, res) => {
  const { name } = brandValidation.parse(req.body);

  const existingBrand = await Brand.findOne({
    name,
    isDeleted: false,
  });
  if (existingBrand) {
    throw new ApiError(status.BAD_REQUEST, "Brand with this title already exists");
  }
  let image;
  if (req.file) {
    image = req.file.path
  }
  const brand = new Brand({
    name,
    image,
  });
  await brand.save();

  await redis.deleteByPattern("brands*");

  res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Brand created successfully", brand));
  return;
});

export const getAllBrands = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('brands', req.query);
  const cachedBrands = await redis.get(cacheKey);

  if (cachedBrands) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "Brands retrieved successfully", cachedBrands));
  }

  const { page = 1, limit = 10, search, isDeleted } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (search) filter.$text = { search: search };
  if (isDeleted !== undefined) {
    filter.isDeleted = isDeleted === 'true';
  } else {
    filter.isDeleted = false;
  }

  const [brands, total] = await Promise.all([
    Brand.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Brand.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    brands,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, 3600);

  res.status(status.OK).json(new ApiResponse(status.OK, "Brands retrieved successfully", result));
  return;
});

export const getBrandById = asyncHandler(async (req, res) => {
  const brandId = req.params.id;
  const { populate = 'false' } = req.query;
  const cacheKey = generateCacheKey(`brand:${brandId}`, req.query);
  const cachedBrand = await redis.get(cacheKey);

  if (cachedBrand) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved successfully", cachedBrand));
  }

  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");
  }

  let brand;
  if (populate == 'true') {
    brand = await Brand.findOne({
      _id: brandId,
      isDeleted: false,
    }).populate('products');
  } else {
    brand = await Brand.findOne({
      _id: brandId,
      isDeleted: false,
    });
  }

  if (!brand) {
    throw new ApiError(status.NOT_FOUND, "Brand not found");
  }

  await redis.set(cacheKey, brand, 3600);

  res.status(status.OK).json(new ApiResponse(status.OK, "Brand retrieved successfully", brand));
  return;
});

export const updateBrandById = asyncHandler(async (req, res) => {
  const brandId = req.params.id;
  const { name } = brandUpdateValidation.parse(req.body);
  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");
  }
  const brand = await Brand.findOne({
    _id: brandId,
    isDeleted: false,
  });

  if (!brand) {
    throw new ApiError(status.NOT_FOUND, "Brand not found");
  }

  if (name) {
    if (name !== brand.name) {
      const existingBrand = await Brand.findOne({
        name,
        isDeleted: false,
        _id: { $ne: brandId },
      });

      if (existingBrand) {
        throw new ApiError(status.BAD_REQUEST, "Brand with this name already exists");
      }
    }
  }

  if (req.file) {
    if (brand.image) {
      const publicId = brand.image.split("/").pop()?.split(".")[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
      }
    }
  }
  const updatedBrand = await Brand.findByIdAndUpdate(
    brandId,
    {
      name,
      image: req.file ? req.file.path : brand.image,
    },
    { new: true }
  );

  await redis.deleteByPattern("brands*");
  await redis.deleteByPattern(`brand:${brandId}`);

  res.status(status.OK).json(
    new ApiResponse(status.OK, "Brand updated successfully", updatedBrand)
  );
  return;
});

export const deleteBrandById = asyncHandler(async (req, res) => {
  const brandId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");
  }
  const brand = await Brand.findOne({
    _id: brandId,
    isDeleted: false,
  });
  if (!brand) {
    throw new ApiError(status.NOT_FOUND, "Brand not found");
  }
  brand.isDeleted = true;
  await brand.save();

  await redis.deleteByPattern("brands*");
  await redis.deleteByPattern(`brand:${brandId}`);

  res.json(new ApiResponse(status.OK, "Brand deleted successfully", brand));
  return;
});