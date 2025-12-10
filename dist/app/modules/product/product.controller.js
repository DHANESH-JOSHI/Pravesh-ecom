"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductFilters = exports.getRelatedProducts = exports.deleteProduct = exports.updateProduct = exports.getProductById = exports.getAllProducts = exports.getProductBySlug = exports.createProduct = void 0;
const redis_1 = require("../../config/redis");
const product_model_1 = require("./product.model");
const utils_1 = require("../../utils");
const cloudinary_1 = require("../../config/cloudinary");
const interface_1 = require("../../interface");
const product_validation_1 = require("./product.validation");
const category_model_1 = require("../category/category.model");
const brand_model_1 = require("../brand/brand.model");
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importDefault(require("mongoose"));
const brand_controller_1 = require("../brand/brand.controller");
const user_interface_1 = require("../user/user.interface");
const ApiError = (0, interface_1.getApiErrorClass)("PRODUCT");
const ApiResponse = (0, interface_1.getApiResponseClass)("PRODUCT");
exports.createProduct = (0, utils_1.asyncHandler)(async (req, res) => {
    const productData = product_validation_1.createProductValidation.parse(req.body);
    if (productData.categoryId) {
        const existingCategory = await category_model_1.Category.findById(productData.categoryId);
        if (!existingCategory) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid category ID');
        }
    }
    if (productData.brandId) {
        const existingBrand = await brand_model_1.Brand.findById(productData.brandId);
        if (!existingBrand) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid brand ID');
        }
    }
    if (req.file) {
        productData.thumbnail = req.file.path;
    }
    // if (req.files && typeof req.files === 'object') {
    //   const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    //   if (Array.isArray(files['thumbnail']) && files['thumbnail'][0]) {
    //     productData.thumbnail = files['thumbnail'][0].path;
    //   }
    //   if (Array.isArray(files['images'])) {
    //     productData.images = files['images'].map((file) => file.path);
    //   }
    // }
    const product = await product_model_1.Product.create({
        ...productData,
        category: productData.categoryId,
        brand: productData.brandId,
    });
    await redis_1.redis.deleteByPattern('products*');
    await redis_1.redis.delete(`category:${product.category}?populate=true`);
    await redis_1.redis.delete(`brand:${product.brand}?populate=true`);
    await redis_1.redis.delete('product_filters');
    await redis_1.redis.delete('dashboard:stats');
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, 'Product created successfully', product));
    return;
});
exports.getProductBySlug = (0, utils_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const { populate = 'false' } = req.query;
    const isAdmin = req.user?.role === user_interface_1.UserRole.ADMIN;
    const cacheKey = (0, utils_1.generateCacheKey)(`product:${slug}`, { ...req.query, isAdmin });
    const cachedProduct = await redis_1.redis.get(cacheKey);
    if (cachedProduct) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product retrieved', cachedProduct));
    }
    if (!slug || slug.trim() === '') {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Slug is required');
    }
    let product;
    if (populate === 'true') {
        product = await product_model_1.Product.findOne({ slug, isDeleted: false })
            .populate('category brand');
    }
    else {
        product = await product_model_1.Product.findOne({ slug, isDeleted: false });
    }
    if (!product) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found');
    }
    // Remove price if not admin
    if (!isAdmin) {
        product = product.toObject ? product.toObject() : product;
        delete product.originalPrice;
    }
    await redis_1.redis.set(cacheKey, product, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product retrieved', product));
    return;
});
exports.getAllProducts = (0, utils_1.asyncHandler)(async (req, res) => {
    const query = product_validation_1.productsQueryValidation.parse(req.query);
    const isAdmin = req.user?.role === user_interface_1.UserRole.ADMIN;
    const cacheKey = (0, utils_1.generateCacheKey)("products", { ...query, isAdmin });
    const cachedProducts = await redis_1.redis.get(cacheKey);
    if (cachedProducts) {
        return res
            .status(http_status_1.default.OK)
            .json(new ApiResponse(http_status_1.default.OK, "Products retrieved successfully", cachedProducts));
    }
    const { page = 1, limit = 10, sort = "createdAt", order = "desc", categoryId, brandId, minPrice, maxPrice, isFeatured, isNewArrival, search, rating, isDeleted, } = query;
    const filter = { isDeleted: isDeleted ?? false };
    if (categoryId) {
        const allIds = await (0, brand_controller_1.getLeafCategoryIds)(categoryId);
        filter.category = { $in: allIds.map((id) => new mongoose_1.default.Types.ObjectId(id)) };
    }
    if (brandId)
        filter.brand = new mongoose_1.default.Types.ObjectId(brandId);
    if (minPrice || maxPrice) {
        filter.originalPrice = {};
        if (minPrice)
            filter.originalPrice.$gte = Number(minPrice);
        if (maxPrice)
            filter.originalPrice.$lte = Number(maxPrice);
    }
    if (isFeatured !== undefined)
        filter.isFeatured = isFeatured;
    if (isNewArrival !== undefined)
        filter.isNewArrival = isNewArrival;
    if (rating)
        filter.rating = { $gte: Number(rating) };
    const sortMap = {
        trending: "salesCount",
        bestSelling: "totalSold",
        newArrivals: "createdAt",
        featured: "isFeatured",
        rating: "rating",
        price: "originalPrice",
        createdAt: "createdAt",
    };
    const sortField = sortMap[sort] || "createdAt";
    const sortOrder = order === "asc" ? 1 : -1;
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline = [];
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        const searchCriteria = {
            $or: [
                { name: { $regex: searchRegex } },
                { tags: { $regex: searchRegex } },
                { slug: { $regex: searchRegex } }
            ]
        };
        pipeline.push({ $match: searchCriteria });
    }
    pipeline.push({ $match: filter });
    pipeline.push({ $sort: { [sortField]: sortOrder } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: Number(limit) });
    pipeline.push({
        $lookup: {
            from: "categories",
            localField: "category",
            foreignField: "_id",
            pipeline: [
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        slug: 1,
                        path: 1,
                    },
                },
            ],
            as: "category",
        },
    });
    pipeline.push({
        $unwind: { path: "$category", preserveNullAndEmptyArrays: true },
    });
    pipeline.push({
        $lookup: {
            from: "brands",
            localField: "brand",
            foreignField: "_id",
            pipeline: [
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        slug: 1,
                    },
                },
            ],
            as: "brand",
        },
    });
    pipeline.push({
        $unwind: { path: "$brand", preserveNullAndEmptyArrays: true },
    });
    const [products, total] = await Promise.all([
        product_model_1.Product.aggregate(pipeline),
        product_model_1.Product.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    // Remove price if not admin
    const processedProducts = isAdmin
        ? products
        : products.map(({ originalPrice, ...rest }) => rest);
    const result = {
        products: processedProducts,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, 3600);
    return res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "Products retrieved successfully", result));
});
exports.getProductById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { populate = 'false' } = req.query;
    const isAdmin = req.user?.role === user_interface_1.UserRole.ADMIN;
    const cacheKey = (0, utils_1.generateCacheKey)(`product:${id}`, { ...req.query, isAdmin });
    const cachedProduct = await redis_1.redis.get(cacheKey);
    if (cachedProduct) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product retrieved successfully', cachedProduct));
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid product ID');
    }
    let product;
    if (populate == 'true') {
        product = await product_model_1.Product.findById(id).populate('category', 'slug title path').populate('brand', 'slug name').populate({
            path: 'reviews',
            populate: {
                path: 'user',
                select: 'name img'
            }
        });
    }
    else {
        product = await product_model_1.Product.findById(id);
    }
    if (!product) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found');
    }
    if (!isAdmin) {
        product = product.toObject ? product.toObject() : product;
        delete product.originalPrice;
    }
    await redis_1.redis.set(cacheKey, product, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product retrieved successfully', product));
    return;
});
exports.updateProduct = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const updateData = product_validation_1.createProductValidation.partial().parse(req.body);
    const existingProduct = await product_model_1.Product.findOne({ _id: id, isDeleted: false });
    if (!existingProduct) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found');
    }
    if (updateData.categoryId) {
        const existingCategory = await category_model_1.Category.findById(updateData.categoryId);
        if (!existingCategory) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid category ID');
        }
    }
    if (updateData.brandId) {
        const existingBrand = await brand_model_1.Brand.findById(updateData.brandId);
        if (!existingBrand) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid brand ID');
        }
    }
    // if (req.files && typeof req.files === 'object') {
    //   const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    //   if (Array.isArray(files['thumbnail']) && files['thumbnail'][0]) {
    //     updateData.thumbnail = files['thumbnail'][0].path;
    //     if (existingProduct.thumbnail) {
    //       const publicId = existingProduct.thumbnail.split('/').pop()?.split('.')[0];
    //       if (publicId) {
    //         await cloudinary.uploader.destroy(`pravesh-products/${publicId}`);
    //       }
    //     }
    //   }
    //   if (Array.isArray(files['images']) && files['images'].length > 0) {
    //     updateData.images = files['images'].map((file) => file.path);
    //     if (existingProduct.images && existingProduct.images.length > 0) {
    //       const deletionPromises = existingProduct.images.map(imageUrl => {
    //         const publicId = imageUrl.split('/').pop()?.split('.')[0];
    //         if (publicId) {
    //           return cloudinary.uploader.destroy(`pravesh-products/${publicId}`);
    //         }
    //         return Promise.resolve();
    //       });
    //       await Promise.all(deletionPromises);
    //     }
    //   }
    // }
    if (req.file) {
        updateData.thumbnail = req.file.path;
        if (existingProduct.thumbnail) {
            const publicId = existingProduct.thumbnail.split('/').pop()?.split('.')[0];
            if (publicId) {
                await cloudinary_1.cloudinary.uploader.destroy(`pravesh-products/${publicId}`);
            }
        }
    }
    const result = await product_model_1.Product.findByIdAndUpdate(id, {
        ...updateData,
        category: updateData.categoryId,
        brand: updateData.brandId,
    }, { new: true, runValidators: true }).populate('category brand');
    await redis_1.redis.deleteByPattern('products*');
    await redis_1.redis.deleteByPattern(`product:${id}*`);
    await redis_1.redis.delete(`category:${existingProduct.category}?populate=true`);
    await redis_1.redis.delete(`brand:${existingProduct.brand}?populate=true`);
    await redis_1.redis.delete('product_filters');
    await redis_1.redis.delete('dashboard:stats');
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product updated successfully', result));
    return;
});
exports.deleteProduct = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const product = await product_model_1.Product.findById(id);
    if (!product) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found');
    }
    const result = await product_model_1.Product.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!result) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found');
    }
    await redis_1.redis.deleteByPattern('products*');
    await redis_1.redis.deleteByPattern(`product:${id}*`);
    await redis_1.redis.delete(`category:${product.category}?populate=true`);
    await redis_1.redis.delete(`brand:${product.brand}?populate=true`);
    await redis_1.redis.delete('product_filters');
    await redis_1.redis.delete('dashboard:stats');
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product deleted successfully', result));
});
exports.getRelatedProducts = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { limit = 10 } = req.query;
    const limitNumber = Math.min(Number(limit) || 10, 20);
    const isAdmin = req.user?.role === user_interface_1.UserRole.ADMIN;
    const cacheKey = (0, utils_1.generateCacheKey)(`product:${id}:related`, { limit: limitNumber, isAdmin });
    const cachedRelated = await redis_1.redis.get(cacheKey);
    if (cachedRelated) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Related products retrieved successfully', cachedRelated));
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid product ID');
    }
    // Find the current product
    const currentProduct = await product_model_1.Product.findById(id).select('category brand tags');
    if (!currentProduct) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found');
    }
    // Priority 1: Same category
    // Priority 2: Same brand (if exists)
    // Priority 3: Similar tags (if exists)
    // Build match conditions with priority scoring
    const matchConditions = [];
    // Category match (highest priority)
    if (currentProduct.category) {
        matchConditions.push({
            category: currentProduct.category,
            _id: { $ne: new mongoose_1.default.Types.ObjectId(id) },
            isDeleted: false,
        });
    }
    // Brand match (if brand exists)
    if (currentProduct.brand) {
        matchConditions.push({
            brand: currentProduct.brand,
            _id: { $ne: new mongoose_1.default.Types.ObjectId(id) },
            isDeleted: false,
        });
    }
    // Tags match (if tags exist)
    if (currentProduct.tags && currentProduct.tags.length > 0) {
        matchConditions.push({
            tags: { $in: currentProduct.tags },
            _id: { $ne: new mongoose_1.default.Types.ObjectId(id) },
            isDeleted: false,
        });
    }
    // If no match conditions, return empty
    if (matchConditions.length === 0) {
        const result = { products: [], total: 0 };
        await redis_1.redis.set(cacheKey, result, 3600);
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Related products retrieved successfully', result));
    }
    // Use aggregation to find related products with priority scoring
    const pipeline = [
        {
            $match: {
                $or: matchConditions,
            },
        },
        // Add priority score
        {
            $addFields: {
                priority: {
                    $sum: [
                        { $cond: [{ $eq: ['$category', currentProduct.category] }, 3, 0] },
                        { $cond: [{ $eq: ['$brand', currentProduct.brand] }, 2, 0] },
                        {
                            $cond: [
                                {
                                    $gt: [
                                        {
                                            $size: {
                                                $setIntersection: ['$tags', currentProduct.tags || []],
                                            },
                                        },
                                        0,
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    ],
                },
            },
        },
        // Sort by priority (descending), then by rating, then by totalSold
        {
            $sort: {
                priority: -1,
                rating: -1,
                totalSold: -1,
                createdAt: -1,
            },
        },
        // Limit results
        { $limit: limitNumber },
        // Lookup category
        {
            $lookup: {
                from: 'categories',
                localField: 'category',
                foreignField: '_id',
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            slug: 1,
                            path: 1,
                        },
                    },
                ],
                as: 'category',
            },
        },
        {
            $unwind: { path: '$category', preserveNullAndEmptyArrays: true },
        },
        // Lookup brand
        {
            $lookup: {
                from: 'brands',
                localField: 'brand',
                foreignField: '_id',
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            slug: 1,
                        },
                    },
                ],
                as: 'brand',
            },
        },
        {
            $unwind: { path: '$brand', preserveNullAndEmptyArrays: true },
        },
    ];
    // Remove priority field from final output
    pipeline.push({
        $project: {
            priority: 0,
        },
    });
    const relatedProducts = await product_model_1.Product.aggregate(pipeline);
    // Remove price if not admin
    const processedProducts = isAdmin
        ? relatedProducts
        : relatedProducts.map(({ originalPrice, ...rest }) => rest);
    const result = {
        products: processedProducts,
        total: processedProducts.length,
    };
    await redis_1.redis.set(cacheKey, result, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Related products retrieved successfully', result));
    return;
});
exports.getProductFilters = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = 'product_filters';
    const cachedFilters = await redis_1.redis.get(cacheKey);
    if (cachedFilters) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product filters retrieved successfully', cachedFilters));
    }
    const brandIds = await product_model_1.Product.distinct('brand', { isDeleted: false });
    const categoryIds = await product_model_1.Product.distinct('category', { isDeleted: false });
    const [brands, categories, priceRange] = await Promise.all([
        brand_model_1.Brand.find({ _id: { $in: brandIds.filter(Boolean) }, isDeleted: false }).select('name slug'),
        category_model_1.Category.find({ _id: { $in: categoryIds.filter(Boolean) }, isDeleted: false }).select('title slug'),
        // Product.distinct('specifications.color', { isDeleted: false }),
        // Product.distinct('specifications.size', { isDeleted: false }),
        product_model_1.Product.aggregate([
            { $match: { isDeleted: false } },
            {
                $group: {
                    _id: null,
                    minPrice: { $min: '$originalPrice' },
                    maxPrice: { $max: '$originalPrice' },
                },
            },
        ]),
    ]);
    const filters = {
        brands,
        categories,
        // colors: colors.flat().filter(Boolean),
        // sizes: sizes.flat().filter(Boolean),
        priceRange: { minPrice: priceRange?.[0]?.minPrice || 0, maxPrice: priceRange?.[0]?.maxPrice || 0 },
    };
    await redis_1.redis.set(cacheKey, filters, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product filters retrieved successfully', filters));
    return;
});
//# sourceMappingURL=product.controller.js.map