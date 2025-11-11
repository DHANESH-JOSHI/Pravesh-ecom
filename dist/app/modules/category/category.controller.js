"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategoryById = exports.updateCategoryById = exports.getCategoryById = exports.getChildCategories = exports.getAllCategories = exports.createCategory = void 0;
const redis_1 = require("../../config/redis");
// import { cloudinary } from "../../config/cloudinary";
const utils_1 = require("../../utils");
const interface_1 = require("../../interface");
const category_model_1 = require("../category/category.model");
// import { Product } from "../product/product.model";
const brand_model_1 = require("../brand/brand.model");
const category_validation_1 = require("./category.validation");
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_1 = __importDefault(require("http-status"));
const ApiError = (0, interface_1.getApiErrorClass)("CATEGORY");
const ApiResponse = (0, interface_1.getApiResponseClass)("CATEGORY");
exports.createCategory = (0, utils_1.asyncHandler)(async (req, res) => {
    const { title, parentCategoryId } = category_validation_1.categoryValidation.parse(req.body);
    let category = await category_model_1.Category.findOne({
        title,
        parentCategory: new mongoose_1.default.Types.ObjectId(parentCategoryId),
    });
    if (category) {
        if (category.isDeleted) {
            category.isDeleted = false;
        }
        else {
            throw new ApiError(http_status_1.default.BAD_REQUEST, "Category with this title already exists");
        }
    }
    // let image;
    // if (req.file) {
    //   image = req.file.path;
    // }
    if (!category) {
        category = await category_model_1.Category.create({
            title,
            parentCategory: parentCategoryId,
            // image
        });
    }
    // else {
    //   if (category.image) {
    //     const publicId = category.image.split("/").pop()?.split(".")[0];
    //     if (publicId) {
    //       await cloudinary.uploader.destroy(`pravesh-categories/${publicId}`);
    //     }
    //   }
    //   category.image = image;
    //   await category.save();
    // }
    await redis_1.redis.deleteByPattern("categories*");
    await redis_1.redis.delete(`category:${category.parentCategory}?populate=true`);
    await redis_1.redis.delete(`categories:children:${category.parentCategory}`);
    res
        .status(http_status_1.default.CREATED)
        .json(new ApiResponse(http_status_1.default.CREATED, "Category created successfully", category));
    return;
});
exports.getAllCategories = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = (0, utils_1.generateCacheKey)('categories', req.query);
    const cachedCategories = await redis_1.redis.get(cacheKey);
    if (cachedCategories) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Categories retrieved successfully", cachedCategories));
    }
    const { page = 1, limit = 10, search, isDeleted, isParent, populate = 'false' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};
    if (isParent == 'true') {
        filter.parentCategory = null;
    }
    if (search)
        filter.$text = { $search: search };
    if (isDeleted !== undefined) {
        filter.isDeleted = isDeleted === 'true';
    }
    else {
        filter.isDeleted = false;
    }
    const [categories, total] = await Promise.all([
        category_model_1.Category.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate(populate == 'true' ? 'children' : ''),
        category_model_1.Category.countDocuments(filter),
    ]);
    // Augment categories with childCount, productCount and brandCount
    const augmentedCategories = await Promise.all(categories.map(async (cat) => {
        const [childCount, result, brandCount] = await Promise.all([
            category_model_1.Category.countDocuments({ parentCategory: cat._id, isDeleted: false }),
            category_model_1.Category.aggregate([
                { $match: { _id: cat._id } },
                {
                    $graphLookup: {
                        from: "categories",
                        startWith: "$_id",
                        connectFromField: "_id",
                        connectToField: "parentCategory",
                        as: "descendants"
                    }
                },
                {
                    $project: {
                        allCategoryIds: { $concatArrays: [["$_id"], "$descendants._id"] }
                    }
                },
                {
                    $lookup: {
                        from: "products",
                        localField: "allCategoryIds",
                        foreignField: "category",
                        as: "products",
                        pipeline: [
                            { $match: { isDeleted: false } },
                        ]
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalProducts: { $size: "$products" }
                    }
                }
            ]),
            brand_model_1.Brand.countDocuments({ category: cat._id, isDeleted: false }),
        ]);
        return { ...cat.toJSON(), childCount, productCount: result[0]?.totalProducts, brandCount };
    }));
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        categories: augmentedCategories,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Categories retrieved successfully", result));
    return;
});
exports.getChildCategories = (0, utils_1.asyncHandler)(async (req, res) => {
    const parentCategoryId = req.params.parentCategoryId;
    const cacheKey = `categories:children:${parentCategoryId}`;
    const cachedCategories = await redis_1.redis.get(cacheKey);
    if (cachedCategories) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Child categories retrieved successfully", cachedCategories));
    }
    const childCategories = await category_model_1.Category.find({
        parentCategory: parentCategoryId,
        isDeleted: false
    }).select('_id title');
    await redis_1.redis.set(cacheKey, childCategories, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Child categories retrieved successfully", childCategories));
    return;
});
exports.getCategoryById = (0, utils_1.asyncHandler)(async (req, res) => {
    const categoryId = req.params.id;
    const { populate = 'false' } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)(`category:${categoryId}`, req.query);
    const cachedCategory = await redis_1.redis.get(cacheKey);
    if (cachedCategory) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category retrieved successfully", cachedCategory));
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid category ID");
    }
    let category;
    if (populate == 'true') {
        category = await category_model_1.Category.findOne({
            _id: categoryId,
            isDeleted: false,
        }).populate('parentCategory children products brands');
    }
    else {
        category = await category_model_1.Category.findOne({
            _id: categoryId,
            isDeleted: false,
        }).populate('parentCategory', '_id title');
    }
    if (!category) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Category not found");
    }
    await redis_1.redis.set(cacheKey, category, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category retrieved successfully", category));
    return;
});
exports.updateCategoryById = (0, utils_1.asyncHandler)(async (req, res) => {
    const categoryId = req.params.id;
    const { title, parentCategoryId } = category_validation_1.categoryUpdateValidation.parse(req.body);
    if (!mongoose_1.default.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid Category ID");
    }
    const category = await category_model_1.Category.findOne({
        _id: categoryId,
        isDeleted: false,
    });
    if (!category) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Category not found");
    }
    if (title) {
        if (title !== category.title) {
            const existingCategory = await category_model_1.Category.findOne({
                title,
                isDeleted: false,
                _id: { $ne: categoryId },
            });
            if (existingCategory) {
                throw new ApiError(http_status_1.default.BAD_REQUEST, "Category with this title already exists");
            }
        }
    }
    if (parentCategoryId) {
        if (parentCategoryId !== category.parentCategory) {
            const existingParentCategory = await category_model_1.Category.findOne({
                _id: parentCategoryId,
                isDeleted: false,
            });
            if (!existingParentCategory) {
                throw new ApiError(http_status_1.default.BAD_REQUEST, "Category with this parentCategory does not exist");
            }
        }
    }
    // if (req.file) {
    //   if (category.image) {
    //     const publicId = category.image.split("/").pop()?.split(".")[0];
    //     if (publicId) {
    //       await cloudinary.uploader.destroy(`pravesh-categories/${publicId}`);
    //     }
    //   }
    // }
    const updatedCategory = await category_model_1.Category.findByIdAndUpdate(categoryId, {
        title,
        parentCategory: parentCategoryId,
        // image: req.file ? req.file.path : category.image,
    }, { new: true });
    await redis_1.redis.deleteByPattern("categories*");
    await redis_1.redis.deleteByPattern(`category:${category._id}*`);
    await redis_1.redis.delete(`categories:children:${category.parentCategory}`);
    await redis_1.redis.deleteByPattern(`category:${category.parentCategory}*`);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category updated successfully", updatedCategory));
    return;
});
exports.deleteCategoryById = (0, utils_1.asyncHandler)(async (req, res) => {
    const categoryId = req.params.id;
    if (!mongoose_1.default.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid category ID");
    }
    const category = await category_model_1.Category.findOneAndUpdate({ _id: categoryId, isDeleted: false }, { isDeleted: true }, { new: true });
    if (!category) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Category not found");
    }
    await redis_1.redis.deleteByPattern("categories*");
    await redis_1.redis.delete(`categories:children:${category.parentCategory}`);
    await redis_1.redis.deleteByPattern(`category:${category._id}*`);
    await redis_1.redis.deleteByPattern(`category:${category.parentCategory}*`);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category deleted successfully", category));
    return;
});
//# sourceMappingURL=category.controller.js.map