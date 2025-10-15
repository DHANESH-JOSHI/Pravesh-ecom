import { cloudinary } from "@/config/cloudinary";
import { asyncHandler } from "@/utils";
import { getApiErrorClass,getApiResponseClass } from "@/interface";
import { Category } from "../category/category.model";
import { categoryValidation, categoryUpdateValidation } from "./category.validation";
import mongoose from "mongoose";
import { ICategory } from "../category/category.interface";
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

  res
    .status(status.CREATED)
    .json(
      new ApiResponse(status.CREATED, "Category created successfully", category)
    );
});

export const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isDeleted: false }).sort({
    createdAt: -1,
  });

  if (categories.length === 0) {
    throw new ApiError(status.NOT_FOUND, "No categories found");
  }

  res.json(new ApiResponse(status.OK, "Categories retrieved successfully", categories));
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid category ID");
  }
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  }).populate('parentCategory');

  if (!category) {
    throw new ApiError(status.NOT_FOUND, "Category not found");
  }

  res.json(new ApiResponse(status.OK, "Category retrieved successfully", category));
});

export const updateCategoryById = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
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

  const updateData: { title?: string; image?: string; parentCategory?: ICategory['_id'] | null } = {};

  if (req.body.title) {
    if (req.body.title !== category.title) {
      const existingCategory = await Category.findOne({
        title: req.body.title,
        isDeleted: false,
        _id: { $ne: categoryId },
      });

      if (existingCategory) {
        throw new ApiError(status.BAD_REQUEST, "Category with this title already exists");
      }
    }
    updateData.title = req.body.title;
  }

  if (req.body.parentCategory) {
    if (req.body.parentCategoryId !== category.parentCategory) {
      const existingParentCategory = await Category.findOne({
        _id: req.body.parentCategoryId,
        isDeleted: false,
      });
      if (!existingParentCategory) {
        throw new ApiError(status.BAD_REQUEST, "Category with this parentCategory does not exist");
      }
      updateData.parentCategory = existingParentCategory._id;
    }
  }

  if (req.file) {
    updateData.image = req.file.path;

    if (category.image) {
      const publicId = category.image.split("/").pop()?.split(".")[0];
      if (publicId) {
        await cloudinary.uploader.destroy(`pravesh-categories/${publicId}`);
      }
    }
  }

  if (Object.keys(updateData).length > 0) {
    const validatedData = categoryUpdateValidation.parse({ body: updateData });

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      validatedData,
      { new: true }
    );

    res.json(
      new ApiResponse(status.OK, "Category updated successfully", updatedCategory)
    );
    return;
  }

  res.json(new ApiResponse(status.OK, "No changes to update", category));
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

  res.json(new ApiResponse(status.OK, "Category deleted successfully", category));
});
