"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBrandById = exports.updateBrandById = exports.getBrandById = exports.getAllBrands = exports.createBrand = void 0;
const redis_1 = require("../../config/redis");
const brand_model_1 = require("./brand.model");
const brand_validation_1 = require("./brand.validation");
const cloudinary_1 = require("../../config/cloudinary");
const utils_1 = require("../../utils");
const interface_1 = require("../../interface");
const mongoose_1 = __importDefault(require("mongoose"));
const http_status_1 = __importDefault(require("http-status"));
// import { Category } from "../category/category.model";
const product_model_1 = require("../product/product.model");
const ApiError = (0, interface_1.getApiErrorClass)("BRAND");
const ApiResponse = (0, interface_1.getApiResponseClass)("BRAND");
exports.createBrand = (0, utils_1.asyncHandler)(async (req, res) => {
    const { name, categoryId } = brand_validation_1.brandValidation.parse(req.body);
    let existingBrand = await brand_model_1.Brand.findOne({
        name,
        category: categoryId
    });
    if (existingBrand) {
        if (!existingBrand.isDeleted) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, "Brand with this title already exists");
        }
        existingBrand.name = name;
        await existingBrand.save();
    }
    let image;
    if (req.file) {
        image = req.file.path;
    }
    if (!existingBrand) {
        existingBrand = await brand_model_1.Brand.create({
            name,
            category: categoryId,
            image
        });
    }
    else {
        if (existingBrand.image) {
            const publicId = existingBrand.image.split("/").pop()?.split(".")[0];
            if (publicId) {
                await cloudinary_1.cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
            }
        }
        existingBrand.image = image;
        await existingBrand.save();
    }
    await redis_1.redis.deleteByPattern("brands*");
    await redis_1.redis.delete(`category:${categoryId}?populate=true`);
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, "Brand created successfully", existingBrand));
    return;
});
exports.getAllBrands = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = (0, utils_1.generateCacheKey)('brands', req.query);
    const cachedBrands = await redis_1.redis.get(cacheKey);
    if (cachedBrands) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Brands retrieved successfully", cachedBrands));
    }
    const { page = 1, limit = 10, search, isDeleted } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};
    if (search)
        filter.$text = { search: search };
    if (isDeleted !== undefined) {
        filter.isDeleted = isDeleted === 'true';
    }
    else {
        filter.isDeleted = false;
    }
    const [brands, total] = await Promise.all([
        brand_model_1.Brand.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)).populate('category', '_id title'),
        brand_model_1.Brand.countDocuments(filter),
    ]);
    // Augment categories with childCount, productCount and brandCount
    const augmentedBrands = await Promise.all(brands.map(async (brand) => {
        const productCount = await product_model_1.Product.countDocuments({ brand: brand._id, isDeleted: false });
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
    await redis_1.redis.set(cacheKey, result, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Brands retrieved successfully", result));
    return;
});
exports.getBrandById = (0, utils_1.asyncHandler)(async (req, res) => {
    const brandId = req.params.id;
    const { populate = 'false' } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)(`brand:${brandId}`, req.query);
    const cachedBrand = await redis_1.redis.get(cacheKey);
    if (cachedBrand) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Brand retrieved successfully", cachedBrand));
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid brand ID");
    }
    let brand;
    if (populate == 'true') {
        brand = await brand_model_1.Brand.findOne({
            _id: brandId,
            isDeleted: false,
        }).populate('products category');
    }
    else {
        brand = await brand_model_1.Brand.findOne({
            _id: brandId,
            isDeleted: false,
        }).populate('category');
    }
    if (!brand) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Brand not found");
    }
    await redis_1.redis.set(cacheKey, brand, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Brand retrieved successfully", brand));
    return;
});
exports.updateBrandById = (0, utils_1.asyncHandler)(async (req, res) => {
    const brandId = req.params.id;
    const { name } = brand_validation_1.brandUpdateValidation.parse(req.body);
    if (!mongoose_1.default.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid brand ID");
    }
    const brand = await brand_model_1.Brand.findOne({
        _id: brandId,
        isDeleted: false,
    });
    if (!brand) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Brand not found");
    }
    if (name) {
        if (name !== brand.name) {
            const existingBrand = await brand_model_1.Brand.findOne({
                name,
                isDeleted: false,
                _id: { $ne: brandId },
            });
            if (existingBrand) {
                throw new ApiError(http_status_1.default.BAD_REQUEST, "Brand with this name already exists");
            }
        }
    }
    if (req.file) {
        if (brand.image) {
            const publicId = brand.image.split("/").pop()?.split(".")[0];
            if (publicId) {
                await cloudinary_1.cloudinary.uploader.destroy(`pravesh-brands/${publicId}`);
            }
        }
    }
    const updatedBrand = await brand_model_1.Brand.findByIdAndUpdate(brandId, {
        name,
        image: req.file ? req.file.path : brand.image,
    }, { new: true });
    await redis_1.redis.deleteByPattern("brands*");
    await redis_1.redis.deleteByPattern(`brand:${brandId}*`);
    // await redis.delete(`category:${categoryId}?populate=true`)  TODO : Handle multiple categories
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Brand updated successfully", updatedBrand));
    return;
});
exports.deleteBrandById = (0, utils_1.asyncHandler)(async (req, res) => {
    const brandId = req.params.id;
    if (!mongoose_1.default.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid brand ID");
    }
    const brand = await brand_model_1.Brand.findOne({
        _id: brandId,
        isDeleted: false,
    });
    if (!brand) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Brand not found");
    }
    brand.isDeleted = true;
    await brand.save();
    await redis_1.redis.deleteByPattern("brands*");
    await redis_1.redis.deleteByPattern(`brand:${brandId}*`);
    res.json(new ApiResponse(http_status_1.default.OK, "Brand deleted successfully", brand));
    return;
});
//# sourceMappingURL=brand.controller.js.map