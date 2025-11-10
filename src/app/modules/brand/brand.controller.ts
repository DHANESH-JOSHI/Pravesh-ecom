import { redis } from "@/config/redis";
import { Brand } from "./brand.model";
import { brandValidation, brandUpdateValidation } from "./brand.validation";
import { cloudinary } from "@/config/cloudinary";
import { asyncHandler, generateCacheKey } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import mongoose from "mongoose";
import status from "http-status";
import { Category } from "../category/category.model";
import { Product } from "../product/product.model";
const ApiError = getApiErrorClass("BRAND");
const ApiResponse = getApiResponseClass("BRAND");

export const createBrand = asyncHandler(async (req, res) => {
  const { name, categoryId } = brandValidation.parse(req.body);

  let existingBrand = await Brand.findOne({
    name,
    category: categoryId
  });
  if (existingBrand) {
    if (!existingBrand.isDeleted) {
      throw new ApiError(status.BAD_REQUEST, "Brand with this title already exists");
    }
    existingBrand.name = name;
    await existingBrand.save();
  }
  let image;
  if (req.file) {
    image = req.file.path;
  }
  if (!existingBrand) {
    existingBrand = await Brand.create({
      name,
      category: categoryId,
      image
    });
  } else {
    if (existingBrand.image) {
      const publicId = existingBrand.image.split("/").pop()?.split(".")[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
      }
    }
    existingBrand.image = image;
    await existingBrand.save();
  }

  await redis.deleteByPattern("brands*");
  await redis.delete(`category:${categoryId}?populate=true`)

  res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Brand created successfully", existingBrand));
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
      .limit(Number(limit)).populate('category', '_id title'),
    Brand.countDocuments(filter),
  ]);
  // Augment categories with childCount, productCount and brandCount
  const augmentedBrands = await Promise.all(brands.map(async (brand) => {
    const productCount = await Product.countDocuments({ brand: brand._id, isDeleted: false });
    return { ...brand.toJSON(), productCount };
  }));
  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    brands: augmentedBrands,
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
    }).populate('products category');
  } else {
    brand = await Brand.findOne({
      _id: brandId,
      isDeleted: false,
    }).populate('category');
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
  const { name, categoryId } = brandUpdateValidation.parse(req.body);
  if (!mongoose.Types.ObjectId.isValid(brandId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid brand ID");
  }
  const brand = await Brand.findOne({
    _id: brandId,
    category: categoryId,
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

  if (categoryId) {
    if (categoryId !== brand.category) {
      const existingCategory = await Category.findOne({
        _id: categoryId,
        isDeleted: false,
      });
      if (!existingCategory) {
        throw new ApiError(status.BAD_REQUEST, "Category with this id does not exist");
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
      category: categoryId,
      image: req.file ? req.file.path : brand.image,
    },
    { new: true }
  );

  await redis.deleteByPattern("brands*");
  await redis.deleteByPattern(`brand:${brandId}*`);
  await redis.delete(`category:${categoryId}?populate=true`)

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
  await redis.deleteByPattern(`brand:${brandId}*`);

  res.json(new ApiResponse(status.OK, "Brand deleted successfully", brand));
  return;
});