import { asyncHandler, generateCacheKey } from "@/utils";
import { reviewValidation } from "./review.validation";
import mongoose from "mongoose";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import status from "http-status";
import { Product } from "../product/product.model";
import { Review } from "./review.model";
import { redis } from "@/config/redis";
const ApiError = getApiErrorClass("REVIEW")
const ApiResponse = getApiResponseClass("REVIEW")

export const createReview = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { productId, rating, comment } = reviewValidation.parse(req.body);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid productId")
    }
    const existingProduct = await Product.findOne({ _id: productId, isDeleted: false, status: 'active' });
    if (!existingProduct) {
        throw new ApiError(status.NOT_FOUND, "Product not found")
    }
    const review = await Review.create({
        product: productId,
        user: userId,
        rating,
        comment
    })

    await redis.deleteByPattern(`reviews:product:${productId}*`);
    await redis.deleteByPattern('reviews*');

    res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Review created successfully", review))
})

export const getProductReviews = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const cacheKey = generateCacheKey(`reviews:product:${productId}`, req.query);
    const cachedReviews = await redis.get(cacheKey);

    if (cachedReviews) {
        return res.status(status.OK).json(new ApiResponse(status.OK, "Reviews retrieved successfully", cachedReviews))
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid productId")
    }
    const existingProduct = await Product.findOne({ _id: productId, isDeleted: false, status: 'active' });
    if (!existingProduct) {
        throw new ApiError(status.NOT_FOUND, "Product not found")
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
        Review.find({ product: productId })
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Review.countDocuments({ product: productId })
    ]);

    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        reviews,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };

    await redis.set(cacheKey, result);

    res.status(status.OK).json(new ApiResponse(status.OK, "Reviews retrieved successfully", result))
})


export const getAllReviews = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const cacheKey = generateCacheKey('reviews', req.query);
    const cachedReviews = await redis.get(cacheKey);

    if (cachedReviews) {
        return res.status(status.OK).json(new ApiResponse(status.OK, "All reviews retrieved successfully", cachedReviews))
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
        Review.find()
            .populate('user', 'name email')
            .populate('product', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Review.countDocuments()
    ]);

    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        reviews,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };

    await redis.set(cacheKey, result);

    res.status(status.OK).json(new ApiResponse(status.OK, "All reviews retrieved successfully", result))
})

export const getMyReviews = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const [reviews, total] = await Promise.all([
        Review.find({ user: userId })
            .populate('product', 'name thumbnail slug')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Review.countDocuments({ user: userId })
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.status(status.OK).json(new ApiResponse(status.OK, "Your reviews retrieved successfully", {
        reviews,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    }))
})

export const updateReview = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const reviewId = req.params.id;
    const { rating, comment } = reviewValidation.partial().parse(req.body);

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid review ID")
    }
    const existingReview = await Review.findOne({ _id: reviewId, user: userId });
    if (!existingReview) {
        throw new ApiError(status.NOT_FOUND, "Review not found or you are not authorized to update it")
    }
    existingReview.rating = rating ?? existingReview.rating;
    existingReview.comment = comment ?? existingReview.comment;
    await existingReview.save();

    await redis.deleteByPattern(`reviews:product:${existingReview.product}*`);
    await redis.deleteByPattern('reviews*');

    res.status(status.OK).json(new ApiResponse(status.OK, "Review updated successfully", existingReview))
})

export const deleteReview = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const reviewId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid review ID")
    }
    const existingReview = await Review.findOne({ _id: reviewId, user: userId });
    if (!existingReview) {
        throw new ApiError(status.NOT_FOUND, "Review not found or you are not authorized to delete it")
    }
    await existingReview.deleteOne();

    await redis.deleteByPattern(`reviews:product:${existingReview.product}*`);
    await redis.deleteByPattern('reviews*');

    res.status(status.OK).json(new ApiResponse(status.OK, "Review deleted successfully", existingReview))
})