import { redis } from "@/config/redis";
import { cloudinary } from "@/config/cloudinary";
import { asyncHandler, generateCacheKey } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import { Category } from "../category/category.model";
import { categoryValidation, categoryUpdateValidation } from "./category.validation";
import mongoose from "mongoose";
import status from "http-status";
const ApiError = getApiErrorClass("CATEGORY");
const ApiResponse = getApiResponseClass("CATEGORY");


export const createCategory = asyncHandler(async (req, res) => {
  const { title, parentCategoryId } = categoryValidation.parse(req.body);

  const existingCategory = await Category.findOne({
    title,
    parentCategory: parentCategoryId,
    isDeleted: false,
  });
  if (existingCategory) {
    throw new ApiError(status.BAD_REQUEST, "Category with this title already exists");
  }

  if (!req.file) {
    throw new ApiError(status.BAD_REQUEST, "Image is required");
  }

  const image = req.file.path;

  const category = await Category.create({
    title,
    parentCategory: parentCategoryId,
    image
  });

  await redis.deleteByPattern("categories*");

  res
    .status(status.CREATED)
    .json(
      new ApiResponse(status.CREATED, "Category created successfully", category)
    );
  return;
});

export const getAllCategories = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('categories', req.query);
  const cachedCategories = await redis.get(cacheKey);

  if (cachedCategories) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "Categories retrieved successfully", cachedCategories));
  }

  const { page = 1, limit = 10, search, isDeleted } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (search) filter.title = { $regex: search, $options: 'i' };
  if (isDeleted !== undefined) {
    filter.isDeleted = isDeleted === 'true';
  } else {
    filter.isDeleted = false;
  }

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)).populate('parentCategory'),
    Category.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    categories,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, 3600);

  res.status(status.OK).json(new ApiResponse(status.OK, "Categories retrieved successfully", result));
  return;
});

export const getChildCategories = asyncHandler(async (req, res) => {
  const parentCategoryId = req.params.parentCategoryId;
  const cacheKey = `categories:children:${parentCategoryId}`;
  const cachedCategories = await redis.get(cacheKey);

  if (cachedCategories) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "Child categories retrieved successfully", cachedCategories));
  }

  const childCategories = await Category.find({
    parentCategory: parentCategoryId,
    isDeleted: false
  });

  await redis.set(cacheKey, childCategories, 3600);

  res.status(status.OK).json(new ApiResponse(status.OK, "Child categories retrieved successfully", childCategories));
  return;
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  const { populate = 'false' } = req.query;
  const cacheKey = `category:${categoryId}:${populate}`;
  const cachedCategory = await redis.get(cacheKey);

  if (cachedCategory) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "Category retrieved successfully", cachedCategory));
  }

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid category ID");
  }
  let category;
  if (populate === 'true') {
    category = await Category.findOne({
      _id: categoryId,
      isDeleted: false,
    }).populate('parentCategory');
  } else {
    category = await Category.findOne({
      _id: categoryId,
      isDeleted: false,
    });
  }

  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  await redis.set(cacheKey, category, 3600);

  res.status(status.OK).json(new ApiResponse(status.OK, "Category retrieved successfully", category));
  return;
});

export const updateCategoryById = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  const { title, parentCategoryId } = categoryUpdateValidation.parse(req.body);
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid Category ID");
  }
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  });

  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }
  if (title) {
    if (title !== category.title) {
      const existingCategory = await Category.findOne({
        title,
        isDeleted: false,
        _id: { $ne: categoryId },
      });

      if (existingCategory) {
        throw new ApiError(status.BAD_REQUEST, "Category with this title already exists");
      }
    }
  }

  if (parentCategoryId) {
    if (parentCategoryId !== category.parentCategory) {
      const existingParentCategory = await Category.findOne({
        _id: parentCategoryId,
        isDeleted: false,
      });
      if (!existingParentCategory) {
        throw new ApiError(status.BAD_REQUEST, "Category with this parentCategory does not exist");
      }
    }
  }

  if (req.file) {
    if (category.image) {
      const publicId = category.image.split("/").pop()?.split(".")[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`pravesh-categories/${publicId}`);
      }
    }
  }


  const updatedCategory = await Category.findByIdAndUpdate(
    categoryId,
    {
      title,
      parentCategory: parentCategoryId,
      image: req.file ? req.file.path : category.image,
    },
    { new: true }
  );

  await redis.deleteByPattern("categories*");
  await redis.deleteByPattern(`category:${categoryId}*`);

  res.status(status.OK).json(
    new ApiResponse(status.OK, "Category updated successfully", updatedCategory)
  );
  return;
});

export const deleteCategoryById = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid category ID");
  }

  const category = await Category.findOneAndUpdate(
    { _id: categoryId, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );

  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  await redis.deleteByPattern("categories*");
  await redis.deleteByPattern(`category:${categoryId}*`);

  res.status(status.OK).json(new ApiResponse(status.OK, "Category deleted successfully", category));
  return;
});
