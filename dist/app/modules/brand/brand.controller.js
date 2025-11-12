"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBrand = exports.updateBrand = exports.getBrandBySlug = exports.getBrandById = exports.getAllBrands = exports.createBrand = void 0;
const redis_1 = require("../../config/redis");
const brand_model_1 = require("./brand.model");
const brand_validation_1 = require("./brand.validation");
const cloudinary_1 = require("../../config/cloudinary");
const utils_1 = require("../../utils");
const interface_1 = require("../../interface");
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_1 = __importDefault(require("http-status"));
const product_model_1 = require("../product/product.model");
const category_model_1 = require("../category/category.model");
const ApiError = (0, interface_1.getApiErrorClass)("BRAND");
const ApiResponse = (0, interface_1.getApiResponseClass)("BRAND");
exports.createBrand = (0, utils_1.asyncHandler)(async (req, res) => {
    const { name, categoryIds } = brand_validation_1.brandValidation.parse(req.body);
    let brand = await brand_model_1.Brand.findOne({ name });
    if (brand && !brand.isDeleted) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Brand with this name already exists");
    }
    if (req.file && brand?.image) {
        const publicId = brand.image.split("/").pop()?.split(".")[0];
        if (publicId)
            await cloudinary_1.cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
    }
    const image = req.file ? req.file.path : brand?.image || undefined;
    if (!brand) {
        brand = await brand_model_1.Brand.create({
            name,
            categories: categoryIds || [],
            image,
        });
    }
    else {
        brand.isDeleted = false;
        brand.name = name;
        brand.categories = categoryIds || [];
        brand.image = image;
        await brand.save();
    }
    await syncBrandCategories(brand._id, categoryIds || []);
    await redis_1.redis.deleteByPattern("brands*");
    res
        .status(http_status_1.default.CREATED)
        .json(new ApiResponse(http_status_1.default.CREATED, "Brand created successfully", brand));
});
exports.getAllBrands = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = (0, utils_1.generateCacheKey)("brands", req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res
            .status(http_status_1.default.OK)
            .json(new ApiResponse(http_status_1.default.OK, "Brands retrieved successfully", cached));
    const { page = 1, limit = 10, search, categoryId, sort = "createdAt", order = "desc", isDeleted = "false", } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = { isDeleted: isDeleted === "true" };
    if (search)
        filter.$text = { $search: search };
    if (categoryId)
        filter.categories = categoryId;
    const sortOrder = order === "asc" ? 1 : -1;
    const sortObj = { [sort]: sortOrder };
    const [brands, total] = await Promise.all([
        brand_model_1.Brand.find(filter).sort(sortObj).skip(skip).limit(Number(limit)),
        brand_model_1.Brand.countDocuments(filter),
    ]);
    const augmented = await Promise.all(brands.map(async (b) => {
        const [productCount, categoryCount] = await Promise.all([
            product_model_1.Product.countDocuments({ brand: b._id, isDeleted: false }),
            category_model_1.Category.countDocuments({ brands: b._id, isDeleted: false }),
        ]);
        return { ...b.toJSON(), productCount, categoryCount };
    }));
    const totalPages = Math.ceil(total / Number(limit));
    const result = { brands: augmented, total, page: Number(page), totalPages };
    await redis_1.redis.set(cacheKey, result, 3600);
    res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "Brands retrieved successfully", result));
});
exports.getBrandById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id))
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid brand ID");
    const cacheKey = (0, utils_1.generateCacheKey)(`brand:${id}`, req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Brand retrieved", cached));
    const { populate = "false" } = req.query;
    const query = brand_model_1.Brand.findOne({ _id: id, isDeleted: false });
    const brand = populate === "true"
        ? await query.populate("categories products")
        : await query;
    if (!brand)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Brand not found");
    await redis_1.redis.set(cacheKey, brand, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Brand retrieved successfully", brand));
});
exports.getBrandBySlug = (0, utils_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const cacheKey = (0, utils_1.generateCacheKey)(`brand:${slug}`, req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Brand retrieved", cached));
    const { populate = "false" } = req.query;
    if (!slug || slug.trim() === "") {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid brand slug");
    }
    const query = brand_model_1.Brand.findOne({ slug, isDeleted: false });
    const brand = populate === "true"
        ? await query.populate("categories products")
        : await query;
    if (!brand)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Brand not found");
    await redis_1.redis.set(cacheKey, brand, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Brand retrieved successfully", brand));
});
exports.updateBrand = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name, categoryIds } = brand_validation_1.brandUpdateValidation.parse(req.body);
    if (!mongoose_1.default.Types.ObjectId.isValid(id))
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid brand ID");
    const brand = await brand_model_1.Brand.findOne({ _id: id, isDeleted: false });
    if (!brand)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Brand not found");
    if (name && name !== brand.name) {
        const exists = await brand_model_1.Brand.findOne({ name, _id: { $ne: id }, isDeleted: false });
        if (exists)
            throw new ApiError(http_status_1.default.BAD_REQUEST, "Brand name already exists");
    }
    if (req.file && brand.image) {
        const publicId = brand.image.split("/").pop()?.split(".")[0];
        if (publicId)
            await cloudinary_1.cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
    }
    brand.name = name || brand.name;
    brand.image = req.file ? req.file.path : brand.image;
    brand.categories = categoryIds || brand.categories;
    await brand.save();
    await redis_1.redis.deleteByPattern("brands*");
    await redis_1.redis.deleteByPattern(`brand:${id}*`);
    for (const categoryId of brand.categories) {
        await redis_1.redis.delete(`category:${categoryId}?populate=true`);
    }
    res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "Brand updated successfully", brand));
});
exports.deleteBrand = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id))
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid brand ID");
    const brand = await brand_model_1.Brand.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { new: true });
    if (!brand)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Brand not found");
    // Remove brand from categories
    await category_model_1.Category.updateMany({ brands: id }, { $pull: { brands: id } });
    // Optionally: nullify brand in products
    await product_model_1.Product.updateMany({ brand: id }, { $unset: { brand: "" } });
    await redis_1.redis.deleteByPattern("brands*");
    await redis_1.redis.deleteByPattern(`brand:${id}*`);
    for (const categoryId of brand.categories) {
        await redis_1.redis.delete(`category:${categoryId}?populate=true`);
    }
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Brand deleted successfully", brand));
});
async function syncBrandCategories(brandId, newCategoryIds) {
    await category_model_1.Category.updateMany({ brands: brandId, _id: { $nin: newCategoryIds } }, { $pull: { brands: brandId } });
    if (newCategoryIds.length > 0) {
        await category_model_1.Category.updateMany({ _id: { $in: newCategoryIds } }, { $addToSet: { brands: brandId } });
    }
}
//# sourceMappingURL=brand.controller.js.map