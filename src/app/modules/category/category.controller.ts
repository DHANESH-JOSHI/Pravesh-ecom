import { Category } from "./category.model";
import { categoryValidation, categoryUpdateValidation } from "./category.validation";
import { cloudinary } from "@/config/cloudinary";
import { asyncHandler } from "@/utils";
import { ApiError, ApiResponse } from "@/interface";
import { ICategory } from "./category.interface";

export const createCategory = asyncHandler(async (req, res, next) => {
  const { title, parentId } = req.body;

  const existingCategory = await Category.findOne({
    title,
    parentId,
    isDeleted: false,
  });
  if (existingCategory) {
    throw new ApiError(400, "Category with this title already exists");
  }

  if (!req.file) {
    throw new ApiError(400, "Image is required");
  }

  const image = req.file.path;

  const validatedData = categoryValidation.parse({
    title,
    image,
    parentId,
  });

  const category = new Category(validatedData);
  await category.save();

  res
    .status(201)
    .json(
      new ApiResponse(201, "Category created successfully", category)
    );
});

export const getAllCategories = asyncHandler(async (req, res, next) => {
  const categories = await Category.find({ isDeleted: false }).sort({
    createdAt: -1,
  });

  if (categories.length === 0) {
    throw new ApiError(404, "No categories found");
  }

  res.json(new ApiResponse(200, "Categories retrieved successfully", categories));
});

export const getCategoryById = asyncHandler(async (req, res, next) => {
  const category = await Category.findOne({
    _id: req.params.id,
    isDeleted: false,
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  res.json(new ApiResponse(200, "Category retrieved successfully", category));
});

export const updateCategoryById = asyncHandler(async (req, res, next) => {
  const categoryId = req.params.id;

  const category = await Category.findOne({
    _id: categoryId,
    isDeleted: false,
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  const updateData: { title?: string; image?: string; parentId?: ICategory['_id'] | null } = {};

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

  if (req.body.parentId) {
    if (req.body.parentId !== category.parentId) {
      const existingParentCategory = await Category.findOne({
        _id: req.body.parentId,
        isDeleted: false,
      });
      if (!existingParentCategory) {
        throw new ApiError(400, "Category with this parentId does not exist");
      }
      updateData.parentId = existingParentCategory._id;
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
    const validatedData = categoryUpdateValidation.parse(updateData);

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

export const deleteCategoryById = asyncHandler(async (req, res, next) => {
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  res.json(new ApiResponse(200, "Category deleted successfully", category));
});
