"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteReview = exports.updateReview = exports.getMyReviews = exports.getAllReviews = exports.getProductReviews = exports.createReview = exports.getReviewById = void 0;
const utils_1 = require("../../utils");
const review_validation_1 = require("./review.validation");
const mongoose_1 = __importDefault(require("mongoose"));
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const product_model_1 = require("../product/product.model");
const user_model_1 = require("../user/user.model");
const review_model_1 = require("./review.model");
const redis_1 = require("../../config/redis");
const ApiError = (0, interface_1.getApiErrorClass)("REVIEW");
const ApiResponse = (0, interface_1.getApiResponseClass)("REVIEW");
const updateProductRating = async (productId, session) => {
    const stats = await review_model_1.Review.aggregate([
        { $match: { product: new mongoose_1.default.Types.ObjectId(productId) } },
        {
            $group: {
                _id: '$product',
                reviewCount: { $sum: 1 },
                rating: { $avg: '$rating' }
            }
        }
    ]).session(session);
    let reviewCount = 0;
    let rating = 0;
    if (stats.length > 0) {
        reviewCount = stats[0].reviewCount;
        rating = stats[0].rating;
    }
    await product_model_1.Product.findByIdAndUpdate(productId, {
        reviewCount,
        rating
    }, { session });
    await redis_1.redis.deleteByPattern(`product:${productId}*`);
    return;
};
exports.getReviewById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const cacheKey = `review:${id}`;
    const cachedReview = await redis_1.redis.get(cacheKey);
    if (cachedReview) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Review retrieved successfully', cachedReview));
    }
    const review = await review_model_1.Review.findById(id).populate('user', 'name email').populate('product', 'name');
    if (!review) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Review not found");
    }
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Review retrieved successfully', review));
    return;
});
exports.createReview = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { productId, rating, comment } = review_validation_1.reviewValidation.parse(req.body);
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(productId)) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid productId");
        }
        const existingProduct = await product_model_1.Product.findOne({ _id: productId, isDeleted: false }).session(session);
        if (!existingProduct) {
            throw new ApiError(http_status_1.default.NOT_FOUND, "Product not found");
        }
        const review = (await review_model_1.Review.create([{
                product: productId,
                user: userId,
                rating,
                comment
            }], { session }))[0];
        await updateProductRating(productId, session);
        await session.commitTransaction();
        await redis_1.redis.deleteByPattern(`reviews:product:${productId}*`);
        await redis_1.redis.deleteByPattern(`reviews:user:${userId}*`);
        await redis_1.redis.delete(`product:${review.product}?populate=true`);
        await redis_1.redis.delete(`user:${userId}?populate=true`);
        await redis_1.redis.deleteByPattern('reviews:all*');
        await redis_1.redis.deleteByPattern(`reviews:user:${userId}*`);
        res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, "Review created successfully", review));
        return;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
exports.getProductReviews = (0, utils_1.asyncHandler)(async (req, res) => {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)(`reviews:product:${productId}`, req.query);
    const cachedReviews = await redis_1.redis.get(cacheKey);
    if (cachedReviews) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Reviews retrieved successfully", cachedReviews));
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(productId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid productId");
    }
    const existingProduct = await product_model_1.Product.findOne({ _id: productId, isDeleted: false });
    if (!existingProduct) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Product not found");
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
        review_model_1.Review.find({ product: productId })
            .populate('user', 'name email img')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        review_model_1.Review.countDocuments({ product: productId })
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        reviews,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, 600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Reviews retrieved successfully", result));
    return;
});
exports.getAllReviews = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, rating, user, product, search } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)("reviews:all", req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res
            .status(http_status_1.default.OK)
            .json(new ApiResponse(http_status_1.default.OK, "All reviews retrieved successfully", cached));
    const filter = {};
    if (rating)
        filter.rating = Number(rating);
    if (user) {
        if (mongoose_1.default.Types.ObjectId.isValid(user)) {
            filter.user = new mongoose_1.default.Types.ObjectId(user);
        }
        else {
            const users = await user_model_1.User.aggregate([
                {
                    $search: {
                        index: "autocomplete_index",
                        compound: {
                            should: [
                                {
                                    autocomplete: {
                                        query: user,
                                        path: "name",
                                        fuzzy: { maxEdits: 1 }
                                    }
                                },
                                {
                                    autocomplete: {
                                        query: user,
                                        path: "email",
                                        fuzzy: { maxEdits: 1 }
                                    }
                                },
                                {
                                    autocomplete: {
                                        query: user,
                                        path: "phone",
                                        fuzzy: { maxEdits: 1 }
                                    }
                                }
                            ]
                        }
                    }
                },
                { $project: { _id: 1 } }
            ]);
            const ids = users.map((u) => u._id);
            filter.user = { $in: ids };
        }
    }
    if (product) {
        if (mongoose_1.default.Types.ObjectId.isValid(product)) {
            filter.product = new mongoose_1.default.Types.ObjectId(product);
        }
        else {
            const products = await product_model_1.Product.aggregate([
                {
                    $search: {
                        index: "autocomplete_index",
                        compound: {
                            should: [
                                {
                                    autocomplete: {
                                        query: product,
                                        path: "name",
                                        fuzzy: { maxEdits: 1 }
                                    }
                                },
                                {
                                    autocomplete: {
                                        query: product,
                                        path: "tags",
                                        fuzzy: { maxEdits: 1 }
                                    }
                                },
                                {
                                    autocomplete: {
                                        query: product,
                                        path: "slug",
                                        fuzzy: { maxEdits: 1 }
                                    }
                                }
                            ]
                        }
                    }
                },
                { $project: { _id: 1 } }
            ]);
            const ids = products.map((p) => p._id);
            filter.product = { $in: ids };
        }
    }
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline = [];
    if (search) {
        pipeline.push({
            $search: {
                index: "autocomplete_index",
                autocomplete: {
                    query: search,
                    path: "comment",
                    fuzzy: { maxEdits: 1 }
                }
            }
        });
    }
    pipeline.push({ $match: filter });
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: Number(limit) });
    pipeline.push({
        $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            pipeline: [{ $project: { _id: 1, name: 1, email: 1 } }],
            as: "user"
        }
    });
    pipeline.push({
        $unwind: { path: "$user", preserveNullAndEmptyArrays: true }
    });
    pipeline.push({
        $lookup: {
            from: "products",
            localField: "product",
            foreignField: "_id",
            pipeline: [{ $project: { _id: 1, name: 1 } }],
            as: "product"
        }
    });
    pipeline.push({
        $unwind: { path: "$product", preserveNullAndEmptyArrays: true }
    });
    const reviews = await review_model_1.Review.aggregate(pipeline);
    const total = await review_model_1.Review.countDocuments(filter);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        reviews,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, 600);
    res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "All reviews retrieved successfully", result));
});
exports.getMyReviews = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { page = 1, limit = 10 } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)(`reviews:user:${userId}`, req.query);
    const cachedReviews = await redis_1.redis.get(cacheKey);
    if (cachedReviews) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Your reviews retrieved successfully", cachedReviews));
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
        review_model_1.Review.find({ user: userId })
            .populate('product', 'name thumbnail slug')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        review_model_1.Review.countDocuments({ user: userId })
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        reviews,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, 600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Your reviews retrieved successfully", result));
    return;
});
exports.updateReview = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const reviewId = req.params.id;
    const { rating, comment } = review_validation_1.reviewValidation.partial().parse(req.body);
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(reviewId)) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid review ID");
        }
        const existingReview = await review_model_1.Review.findOne({ _id: reviewId, user: userId }).session(session);
        if (!existingReview) {
            throw new ApiError(http_status_1.default.NOT_FOUND, "Review not found or you are not authorized to update it");
        }
        existingReview.rating = rating ?? existingReview.rating;
        existingReview.comment = comment ?? existingReview.comment;
        await existingReview.save({ session });
        await updateProductRating(existingReview.product.toString(), session);
        await session.commitTransaction();
        await redis_1.redis.delete(`review:${reviewId}`);
        await redis_1.redis.deleteByPattern(`reviews:product:${existingReview.product.toString()}*`);
        await redis_1.redis.delete(`product:${existingReview.product.toString()}?populate=true`);
        await redis_1.redis.delete(`user:${userId}?populate=true`);
        await redis_1.redis.deleteByPattern('reviews:all*');
        await redis_1.redis.deleteByPattern(`reviews:user:${userId}*`);
        res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Review updated successfully", existingReview));
        return;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
exports.deleteReview = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const reviewId = req.params.id;
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        if (!mongoose_1.default.Types.ObjectId.isValid(reviewId)) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid review ID");
        }
        const existingReview = await review_model_1.Review.findOne({ _id: reviewId, user: userId }).session(session);
        if (!existingReview) {
            throw new ApiError(http_status_1.default.NOT_FOUND, "Review not found or you are not authorized to delete it");
        }
        await existingReview.deleteOne({ session });
        await updateProductRating(existingReview.product.toString(), session);
        await session.commitTransaction();
        await redis_1.redis.delete(`review:${reviewId}`);
        await redis_1.redis.deleteByPattern(`reviews:product:${existingReview.product.toString()}*`);
        await redis_1.redis.delete(`product:${existingReview.product.toString()}?populate=true`);
        await redis_1.redis.delete(`user:${userId}?populate=true`);
        await redis_1.redis.deleteByPattern('reviews:all*');
        await redis_1.redis.deleteByPattern(`reviews:user:${userId}*`);
        res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Review deleted successfully", existingReview));
        return;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
//# sourceMappingURL=review.controller.js.map