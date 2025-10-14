import { cloudinary } from "@/config/cloudinary";
import { asyncHandler } from "@/utils";
import { ApiError, ApiResponse } from "@/interface";
import { Category } from "../category/category.model";
import { categoryValidation, categoryUpdateValidation } from "./category.validation";
import mongoose from "mongoose";
import { ICategory } from "../category/category.interface";

export const createCategory = asyncHandler(async (req, res) => {
  const { title, parentCategoryId } = categoryValidation.parse(req.body);

  const existingCategory = await Category.findOne({
    title,
    parentCategory: parentCategoryId,
    isDeleted: false,
  });
  if (existingCategory) {
    throw new ApiError(400, "Category with this title already exists");
  }

  if (!req.file) {
    throw new ApiError(400, "Image is required");
  }

  const image = req.file.path;

  const category = await Category.create({
    title,
    parentCategory: parentCategoryId,
    image
  });

  res
    .status(201)
    .json(
      new ApiResponse(201, "Category created successfully", category)
    );
});

export const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isDeleted: false }).sort({
    createdAt: -1,
  });

  if (categories.length === 0) {
    throw new ApiError(404, "No categories found");
  }

  res.json(new ApiResponse(200, "Categories retrieved successfully", categories));
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, "Invalid category ID");
  }
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  }).populate('parentCategory');

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  res.json(new ApiResponse(200, "Category retrieved successfully", category));
});

export const updateCategoryById = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, "Invalid Category ID");
  }
  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
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
        throw new ApiError(400, "Category with this title already exists");
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
        throw new ApiError(400, "Category with this parentCategory does not exist");
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
      new ApiResponse(200, "Category updated successfully", updatedCategory)
    );
    return;
  }

  res.json(new ApiResponse(200, "No changes to update", category));
});

export const deleteCategoryById = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new ApiError(400, "Invalid category ID");
  }

  const category = await Category.findOneAndUpdate(
    { _id: categoryId, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  res.json(new ApiResponse(200, "Category deleted successfully", category));
});
