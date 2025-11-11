"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrendingProducts = exports.getBestSellingProducts = exports.getProductFilters = exports.searchProducts = exports.getProductsByCategory = exports.getNewArrivalProducts = exports.getFeaturedProducts = exports.deleteProduct = exports.updateProduct = exports.getProductById = exports.getAllProducts = exports.getProductBySlug = exports.createProduct = void 0;
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
const slugify_1 = require("../../utils/slugify");
const ApiError = (0, interface_1.getApiErrorClass)("PRODUCT");
const ApiResponse = (0, interface_1.getApiResponseClass)("PRODUCT");
exports.createProduct = (0, utils_1.asyncHandler)(async (req, res) => {
    const productData = product_validation_1.createProductValidation.parse(req.body);
    const existingSku = await product_model_1.Product.findOne({ sku: productData.sku, isDeleted: false });
    if (existingSku) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Product with this SKU already exists');
    }
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
    if (!productData.slug && productData.name) {
        const base = (0, slugify_1.slugify)(productData.name);
        let candidate = base;
        let i = 1;
        while (await product_model_1.Product.findOne({ slug: candidate })) {
            candidate = `${base}-${i++}`;
        }
        productData.slug = candidate;
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
    await redis_1.redis.deleteByPattern('products:all*');
    // await redis.deleteByPattern('products:discount*');
    await redis_1.redis.deleteByPattern('products:featured*');
    await redis_1.redis.deleteByPattern('products:new-arrival*');
    await redis_1.redis.deleteByPattern(`products:category:${product.category}*`);
    await redis_1.redis.deleteByPattern('products:search*');
    await redis_1.redis.delete(`category:${product.category}?populate=true`);
    await redis_1.redis.delete(`brand:${product.brand}?populate=true`);
    await redis_1.redis.delete('product_filters');
    await redis_1.redis.delete('dashboard:stats');
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, 'Product created successfully', product));
    return;
});
// export const getDiscountProducts = asyncHandler(async (req, res) => {
//   const cacheKey = generateCacheKey('products:discount', req.query);
//   const cachedProducts = await redis.get(cacheKey);
//   if (cachedProducts) {
//     return res.status(status.OK).json(
//       new ApiResponse(status.OK, 'Discount products retrieved successfully', cachedProducts)
//     );
//   }
//   const { page = 1, limit = 10 } = req.query;
//   const products = await Product.find({
//     isDiscount: true,
//     isDeleted: false,
//   })
//     .populate('category', 'brand')
//     .sort({ discountValue: -1, createdAt: -1 })
//     .skip((Number(page) - 1) * Number(limit))
//     .limit(Number(limit))
//     .lean();
//   await redis.set(cacheKey, products, 3600);
//   res.status(status.OK).json(
//     new ApiResponse(status.OK, 'Discount products retrieved successfully', products)
//   );
//   return;
// });
exports.getProductBySlug = (0, utils_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const { populate = 'false' } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)(`product:${slug}`, req.query);
    const cachedProduct = await redis_1.redis.get(cacheKey);
    if (cachedProduct) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product retrieved successfully', cachedProduct));
    }
    if (!slug || slug.trim() === '') {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Slug is required');
    }
    let product;
    if (populate === 'true') {
        product = await product_model_1.Product.findOne({ slug, isDeleted: false })
            .populate('category', 'brand');
    }
    else {
        product = await product_model_1.Product.findOne({ slug, isDeleted: false });
    }
    if (!product) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found');
    }
    await redis_1.redis.set(cacheKey, product, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product retrieved successfully', product));
    return;
});
exports.getAllProducts = (0, utils_1.asyncHandler)(async (req, res) => {
    const query = product_validation_1.productsQueryValidation.parse(req.query);
    const cacheKey = (0, utils_1.generateCacheKey)('products:all', query);
    const cachedProducts = await redis_1.redis.get(cacheKey);
    if (cachedProducts) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Products retrieved successfully', cachedProducts));
    }
    const { page = 1, limit = 10, sort = 'createdAt', order = 'desc', categoryId, brandId, minPrice, maxPrice, 
    // stockStatus,
    isFeatured, isNewArrival, 
    // isDiscount,
    rating, search, isDeleted, } = query;
    const filter = {};
    if (isDeleted !== undefined) {
        filter.isDeleted = isDeleted;
    }
    else {
        filter.isDeleted = false;
    }
    // if (stockStatus) {
    //   filter.stockStatus = stockStatus;
    // }
    if (categoryId)
        filter.category = categoryId;
    if (brandId)
        filter.brand = brandId;
    if (isFeatured !== undefined)
        filter.isFeatured = isFeatured;
    if (isNewArrival !== undefined)
        filter.isNewArrival = isNewArrival;
    // if (isDiscount !== undefined) filter.isDiscount = isDiscount;
    if (minPrice || maxPrice) {
        filter.originalPrice = {};
        if (minPrice) {
            filter.originalPrice.$gte = Number(minPrice);
        }
        if (maxPrice) {
            filter.originalPrice.$lte = Number(maxPrice);
        }
    }
    if (rating) {
        filter.rating = { $gte: Number(rating) };
    }
    if (search) {
        filter.$text = { $search: search };
    }
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = {};
    sortObj[sort] = sortOrder;
    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
        product_model_1.Product.find(filter)
            .populate('category brand')
            .sort(sortObj)
            .skip(skip)
            .limit(Number(limit)),
        product_model_1.Product.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        products,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Products retrieved successfully', result));
    return;
});
exports.getProductById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { populate = 'false' } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)(`product:${id}`, req.query);
    const cachedProduct = await redis_1.redis.get(cacheKey);
    if (cachedProduct) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product retrieved successfully', cachedProduct));
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid product ID');
    }
    let product;
    if (populate == 'true') {
        product = await product_model_1.Product.findById(id).populate('category', '_id title').populate('brand', '_id name').populate({
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
    }, { new: true, runValidators: true }).populate('category', 'brand');
    await redis_1.redis.deleteByPattern('products:all*');
    await redis_1.redis.deleteByPattern(`product:${id}*`);
    await redis_1.redis.deleteByPattern(`products:search*`);
    await redis_1.redis.deleteByPattern(`products:featured*`);
    await redis_1.redis.deleteByPattern(`products:new-arrival*`);
    // await redis.deleteByPattern(`products:discount*`);
    await redis_1.redis.deleteByPattern(`products:category:${existingProduct.category}*`);
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
    await redis_1.redis.deleteByPattern('products:all*');
    await redis_1.redis.deleteByPattern(`product:${id}*`);
    await redis_1.redis.deleteByPattern(`products:search*`);
    await redis_1.redis.deleteByPattern(`products:featured*`);
    await redis_1.redis.deleteByPattern(`products:new-arrival*`);
    // await redis.deleteByPattern(`products:discount*`);
    await redis_1.redis.deleteByPattern(`products:category:${product.category}*`);
    await redis_1.redis.delete(`category:${product.category}?populate=true`);
    await redis_1.redis.delete(`brand:${product.brand}?populate=true`);
    await redis_1.redis.delete('product_filters');
    await redis_1.redis.delete('dashboard:stats');
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product deleted successfully', result));
});
exports.getFeaturedProducts = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)('products:featured', req.query);
    const cachedProducts = await redis_1.redis.get(cacheKey);
    if (cachedProducts) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Featured products retrieved successfully', cachedProducts));
    }
    const filter = {
        isFeatured: true,
        isDeleted: false,
    };
    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
        product_model_1.Product.find(filter)
            .populate('category', 'brand')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        product_model_1.Product.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        products,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Featured products retrieved successfully', result));
    return;
});
exports.getNewArrivalProducts = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)('products:new-arrival', req.query);
    const cachedProducts = await redis_1.redis.get(cacheKey);
    if (cachedProducts) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'New arrival products retrieved successfully', cachedProducts));
    }
    const filter = {
        isNewArrival: true,
        isDeleted: false,
    };
    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
        product_model_1.Product.find(filter)
            .populate('category', 'brand')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean(),
        product_model_1.Product.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        products,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'New arrival products retrieved successfully', result));
    return;
});
exports.getProductsByCategory = (0, utils_1.asyncHandler)(async (req, res) => {
    const { categoryId } = req.params;
    const cacheKey = (0, utils_1.generateCacheKey)(`products:category:${categoryId}`, req.query);
    const cachedProducts = await redis_1.redis.get(cacheKey);
    if (cachedProducts) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Products retrieved successfully', cachedProducts));
    }
    const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
    const filter = {
        category: categoryId,
        isDeleted: false,
    };
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortObj = {};
    sortObj[sort] = sortOrder;
    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
        product_model_1.Product.find(filter)
            .populate('category', 'brand')
            .sort(sortObj)
            .skip(skip)
            .limit(Number(limit)),
        product_model_1.Product.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        products,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Products retrieved successfully', result));
    return;
});
exports.searchProducts = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = (0, utils_1.generateCacheKey)('products:search', req.query);
    const cachedProducts = await redis_1.redis.get(cacheKey);
    if (cachedProducts) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Products found successfully', cachedProducts));
    }
    const { q, page = 1, limit = 10 } = req.query;
    const filter = {
        isDeleted: false,
    };
    if (q) {
        filter.$text = { $search: q };
    }
    const skip = (Number(page) - 1) * Number(limit);
    let products, total;
    if (q) {
        [products, total] = await Promise.all([
            product_model_1.Product.find(filter, { score: { $meta: 'textScore' } })
                .populate('category brand')
                .sort({ score: { $meta: 'textScore' } })
                .skip(skip)
                .limit(Number(limit)),
            product_model_1.Product.countDocuments(filter),
        ]);
    }
    else {
        [products, total] = await Promise.all([
            product_model_1.Product.find(filter)
                .populate('category brand')
                .skip(skip)
                .limit(Number(limit)),
            product_model_1.Product.countDocuments(filter),
        ]);
    }
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        products,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Products found successfully', result));
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
    const [brands, categories, colors, sizes, priceRange] = await Promise.all([
        brand_model_1.Brand.find({ _id: { $in: brandIds.filter(Boolean) }, isDeleted: false }).select('name _id'),
        category_model_1.Category.find({ _id: { $in: categoryIds.filter(Boolean) }, isDeleted: false }).select('title _id'),
        product_model_1.Product.distinct('specifications.color', { isDeleted: false }),
        product_model_1.Product.distinct('specifications.size', { isDeleted: false }),
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
        colors: colors.flat().filter(Boolean),
        sizes: sizes.flat().filter(Boolean),
        priceRange: { minPrice: priceRange?.[0]?.minPrice || 0, maxPrice: priceRange?.[0]?.maxPrice || 0 },
    };
    await redis_1.redis.set(cacheKey, filters, 3600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product filters retrieved successfully', filters));
    return;
});
exports.getBestSellingProducts = (0, utils_1.asyncHandler)(async (req, res) => {
    const { limit = 10, page = 1 } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)('products:best-selling', req.query);
    const cachedResult = await redis_1.redis.get(cacheKey);
    if (cachedResult) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Best selling products retrieved successfully', cachedResult));
    }
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const filter = {
        isDeleted: false,
        totalSold: { $gt: 0 }
    };
    const [bestSellers, total] = await Promise.all([
        product_model_1.Product.find(filter)
            .populate('category', 'name slug')
            .populate('brand', 'name slug')
            .sort({ totalSold: -1 })
            .skip(skip)
            .limit(limitNumber)
            .select('-__v'),
        product_model_1.Product.countDocuments(filter)
    ]);
    const totalPages = Math.ceil(total / limitNumber);
    const result = {
        products: bestSellers,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, 600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Best selling products retrieved successfully', result));
    return;
});
exports.getTrendingProducts = (0, utils_1.asyncHandler)(async (req, res) => {
    const { limit = 10, page = 1 } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)('products:trending', req.query);
    const cachedResult = await redis_1.redis.get(cacheKey);
    if (cachedResult) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Trending products retrieved successfully', cachedResult));
    }
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;
    const filter = {
        isDeleted: false,
        salesCount: { $gt: 0 }
    };
    const [trending, total] = await Promise.all([
        product_model_1.Product.find(filter)
            .populate('category', 'name slug')
            .populate('brand', 'name slug')
            .sort({ salesCount: -1, updatedAt: -1 })
            .skip(skip)
            .limit(limitNumber)
            .select('-__v'),
        product_model_1.Product.countDocuments(filter)
    ]);
    const totalPages = Math.ceil(total / limitNumber);
    const result = {
        products: trending,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, 600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Trending products retrieved successfully', result));
    return;
});
//# sourceMappingURL=product.controller.js.map