"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.getCategoryBySlug = exports.getCategoryById = exports.getLeafCategories = exports.getCategoryTree = exports.getAllCategories = exports.createCategory = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_1 = __importDefault(require("http-status"));
const category_model_1 = require("./category.model");
const brand_model_1 = require("../brand/brand.model");
const utils_1 = require("../../utils");
const redisKeys_1 = require("../../utils/redisKeys");
const cacheTTL_1 = require("../../utils/cacheTTL");
const redis_1 = require("../../config/redis");
const interface_1 = require("../../interface");
const category_validation_1 = require("./category.validation");
const product_model_1 = require("../product/product.model");
const brand_controller_1 = require("../brand/brand.controller");
const redisKeys_2 = require("../../utils/redisKeys");
const ApiError = (0, interface_1.getApiErrorClass)("CATEGORY");
const ApiResponse = (0, interface_1.getApiResponseClass)("CATEGORY");
exports.createCategory = (0, utils_1.asyncHandler)(async (req, res) => {
    const { title, parentCategoryId } = category_validation_1.categoryValidation.parse(req.body);
    let category = await category_model_1.Category.findOne({ title, parentCategory: parentCategoryId || null, isDeleted: false });
    if (category) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Category with this title already exists under same parent");
    }
    const deletedCategory = await category_model_1.Category.findOne({ title, parentCategory: parentCategoryId || null, isDeleted: true });
    if (deletedCategory) {
        deletedCategory.isDeleted = false;
        deletedCategory.title = title;
        deletedCategory.parentCategory = parentCategoryId;
        await deletedCategory.save();
        category = deletedCategory;
    }
    else {
        category = await category_model_1.Category.create({
            title,
            parentCategory: parentCategoryId || null,
        });
    }
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORIES_ALL());
    await redis_1.redis.delete(redisKeys_1.RedisKeys.CATEGORY_TREE());
    await redis_1.redis.delete(redisKeys_1.RedisKeys.CATEGORY_LEAF());
    if (parentCategoryId) {
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORY_ANY(String(parentCategoryId)));
    }
    if (category && category.slug) {
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORY_BY_SLUG_ANY(category.slug));
    }
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, "Category created", category));
});
exports.getAllCategories = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = redisKeys_1.RedisKeys.CATEGORIES_LIST(req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached) {
        return res
            .status(http_status_1.default.OK)
            .json(new ApiResponse(http_status_1.default.OK, "Categories retrieved", cached));
    }
    const { page = 1, limit = 20, search, parentCategoryId, brandId, isDeleted = "false", sort = "createdAt", order = "desc", } = req.query;
    const filter = {
        isDeleted: isDeleted === "true",
    };
    if (parentCategoryId) {
        filter.parentCategory =
            parentCategoryId === "null" ? null : parentCategoryId;
    }
    if (brandId) {
        const brand = await brand_model_1.Brand.findOne({ _id: brandId, isDeleted: false }).select("categories");
        filter._id = { $in: brand?.categories || [] };
    }
    const sortOrder = order === "desc" ? -1 : 1;
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline = [];
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        const searchCriteria = {
            $or: [
                { name: { $regex: searchRegex } },
                { slug: { $regex: searchRegex } }
            ]
        };
        const combinedMatch = {
            $and: [
                searchCriteria,
                filter
            ]
        };
        pipeline.push({ $match: combinedMatch });
    }
    else {
        pipeline.push({ $match: filter });
    }
    pipeline.push({ $sort: { [sort]: sortOrder } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: Number(limit) });
    pipeline.push({
        $lookup: {
            from: "categories",
            localField: "parentCategory",
            foreignField: "_id",
            pipeline: [
                { $match: { isDeleted: false } },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        slug: 1,
                    },
                },
            ],
            as: "parentCategory",
        },
    });
    pipeline.push({
        $unwind: {
            path: "$parentCategory",
            preserveNullAndEmptyArrays: true,
        },
    });
    const categories = await category_model_1.Category.aggregate(pipeline);
    const total = await category_model_1.Category.countDocuments(filter);
    const totalPages = Math.ceil(total / Number(limit));
    const augmented = await Promise.all(categories.map(async (c) => {
        const [productCount, childCount, brandCount] = await Promise.all([
            countProducts(c._id),
            category_model_1.Category.countDocuments({ parentCategory: c._id, isDeleted: false }),
            countBrands(c._id),
        ]);
        return {
            ...c,
            productCount,
            childCount,
            brandCount,
        };
    }));
    const result = {
        categories: augmented,
        total,
        page: Number(page),
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, cacheTTL_1.CacheTTL.XLONG);
    res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "Categories retrieved", result));
});
exports.getCategoryTree = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = redisKeys_1.RedisKeys.CATEGORY_TREE();
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category tree retrieved", cached));
    const buildTree = async (parent = null) => {
        const nodes = await category_model_1.Category.find({ parentCategory: parent, isDeleted: false }).select("title slug path");
        const children = await Promise.all(nodes.map(async (n) => ({ ...n.toObject(), children: await buildTree(n._id) })));
        return children;
    };
    const tree = await buildTree(null);
    await redis_1.redis.set(cacheKey, tree, cacheTTL_1.CacheTTL.XLONG);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category tree retrieved", tree));
});
exports.getLeafCategories = (0, utils_1.asyncHandler)(async (_, res) => {
    const cacheKey = redisKeys_1.RedisKeys.CATEGORY_LEAF();
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Leaf categories retrieved", cached));
    const leafs = await category_model_1.Category.aggregate([
        { $match: { isDeleted: false } },
        {
            $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "parentCategory",
                pipeline: [
                    { $match: { isDeleted: false } },
                    { $project: { _id: 1 } }
                ],
                as: "children",
            },
        },
        { $match: { children: { $size: 0 } } },
        { $project: { _id: 1, title: 1, slug: 1 } },
    ]);
    await redis_1.redis.set(cacheKey, leafs, cacheTTL_1.CacheTTL.XLONG);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Leaf categories retrieved", leafs));
});
exports.getCategoryById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id))
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid category ID");
    const cacheKey = redisKeys_1.RedisKeys.CATEGORY_BY_ID(id, req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category retrieved", cached));
    const { populate = "false" } = req.query;
    const query = category_model_1.Category.findOne({ _id: id, isDeleted: false });
    const category = populate === "true"
        ? await query.populate([
            { path: "parentCategory", match: { isDeleted: false } },
            { path: "children", match: { isDeleted: false } },
            { path: "brands", match: { isDeleted: false } },
        ])
        : await query.populate({ path: "parentCategory", select: "slug title", match: { isDeleted: false } });
    if (!category)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Category not found");
    const categoryObj = category.toObject ? category.toObject() : category;
    await redis_1.redis.set(cacheKey, categoryObj, cacheTTL_1.CacheTTL.LONG);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category retrieved", category));
});
exports.getCategoryBySlug = (0, utils_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const cacheKey = redisKeys_1.RedisKeys.CATEGORY_BY_SLUG(slug, req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category retrieved", cached));
    const { populate = "false" } = req.query;
    const query = category_model_1.Category.findOne({ slug, isDeleted: false });
    const category = populate === "true"
        ? await query.populate([
            { path: "parentCategory", match: { isDeleted: false } },
            { path: "children", match: { isDeleted: false } },
            { path: "brands", match: { isDeleted: false } },
        ])
        : await query.populate({ path: "parentCategory", select: "slug title", match: { isDeleted: false } });
    if (!category)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Category not found");
    const categoryObj = category.toObject ? category.toObject() : category;
    await redis_1.redis.set(cacheKey, categoryObj, cacheTTL_1.CacheTTL.LONG);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category retrieved", category));
});
exports.updateCategory = (0, utils_1.asyncHandler)(async (req, res) => {
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
    const oldParentCategoryId = category.parentCategory ? String(category.parentCategory) : undefined;
    const newParentCategoryId = parentCategoryId || undefined;
    const oldSlug = category.slug;
    const updatedCategory = await category_model_1.Category.findByIdAndUpdate(categoryId, {
        title,
        parentCategory: parentCategoryId,
        // image: req.file ? req.file.path : category.image,
    }, { new: true });
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORY_ANY(String(category._id)));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORY_BY_SLUG_ANY(oldSlug));
    if (updatedCategory && updatedCategory.slug !== oldSlug) {
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORY_BY_SLUG_ANY(updatedCategory.slug));
    }
    if (oldParentCategoryId) {
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORY_ANY(oldParentCategoryId));
    }
    if (oldParentCategoryId !== newParentCategoryId && newParentCategoryId) {
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORY_ANY(newParentCategoryId));
    }
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORIES_ALL());
    if (oldParentCategoryId !== newParentCategoryId) {
        await redis_1.redis.delete(redisKeys_1.RedisKeys.CATEGORY_TREE());
        await redis_1.redis.delete(redisKeys_1.RedisKeys.CATEGORY_LEAF());
    }
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category updated successfully", updatedCategory));
    return;
});
exports.deleteCategory = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id))
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid ID");
    const deleted = await category_model_1.Category.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { new: true });
    if (!deleted)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Category not found");
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORY_ANY(String(id)));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORY_BY_SLUG_ANY(deleted.slug));
    if (deleted.parentCategory) {
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORY_ANY(String(deleted.parentCategory)));
    }
    await redis_1.redis.delete(redisKeys_1.RedisKeys.CATEGORY_TREE());
    await redis_1.redis.delete(redisKeys_1.RedisKeys.CATEGORY_LEAF());
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CATEGORIES_ALL());
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Category deleted", deleted));
});
async function countBrands(categoryId) {
    const result = await category_model_1.Category.aggregate([
        { $match: { _id: categoryId, isDeleted: false } },
        {
            $graphLookup: {
                from: 'categories',
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'parentCategory',
                as: 'descendants',
                restrictSearchWithMatch: { isDeleted: false }
            }
        },
        {
            $project: {
                descendantIds: {
                    $map: {
                        input: '$descendants',
                        as: 'd',
                        in: '$$d._id'
                    }
                }
            }
        },
        {
            $lookup: {
                from: 'brands',
                let: { dIds: '$descendantIds' },
                pipeline: [
                    { $match: { isDeleted: false } },
                    {
                        $match: {
                            $expr: {
                                $gt: [
                                    {
                                        $size: {
                                            $setIntersection: ['$categories', '$$dIds']
                                        }
                                    },
                                    0
                                ]
                            }
                        }
                    }
                ],
                as: 'matchedBrands'
            }
        },
        {
            $project: {
                _id: 0,
                brandCount: { $size: '$matchedBrands' }
            }
        }
    ]);
    return result[0]?.brandCount || 0;
}
async function countProducts(categoryId) {
    const allIds = await (0, brand_controller_1.getLeafCategoryIds)(categoryId);
    return product_model_1.Product.countDocuments({
        isDeleted: false,
        category: { $in: allIds }
    });
}
//# sourceMappingURL=category.controller.js.map