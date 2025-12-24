import { asyncHandler } from "@/utils";
import { RedisKeys } from "@/utils/redisKeys";
import { CacheTTL } from "@/utils/cacheTTL";
import { reviewValidation } from "./review.validation";
import mongoose from "mongoose";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import status from "http-status";
import { Product } from "../product/product.model";
import { User } from "../user/user.model";
import { Review } from "./review.model";
import { redis } from "@/config/redis";
import { RedisPatterns } from "@/utils/redisKeys";
const ApiError = getApiErrorClass("REVIEW")
const ApiResponse = getApiResponseClass("REVIEW")

const updateProductRating = async (productId: string, session: mongoose.ClientSession) => {
  const stats = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        pipeline: [
          { $match: { isDeleted: false } },
          { $project: { _id: 1 } }
        ],
        as: 'productCheck'
      }
    },
    { $match: { productCheck: { $ne: [] } } },
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
    // Round rating to 1 decimal place for consistency
    rating = Math.round((stats[0].rating || 0) * 10) / 10;
  }

  await Product.findByIdAndUpdate(productId, {
    reviewCount,
    rating
  }, { session });

  await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(String(productId)));
  return;
};

export const getReviewById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = RedisKeys.REVIEW_BY_ID(id);
  const cachedReview = await redis.get(cacheKey);

  if (cachedReview) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'Review retrieved successfully', cachedReview));
  }

  const review = await Review.findById(id)
    .populate({ path: 'user', select: 'name email', match: { isDeleted: false } })
    .populate({ path: 'product', select: 'name', match: { isDeleted: false } });

  if (!review) {
    throw new ApiError(status.NOT_FOUND, "Review not found");
  }

  const reviewObj = (review as any)?.toObject ? (review as any).toObject() : review;
  await redis.set(cacheKey, reviewObj, CacheTTL.SHORT);
  res.status(status.OK).json(new ApiResponse(status.OK, 'Review retrieved successfully', review));
  return;
});

export const createReview = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId, rating, comment } = reviewValidation.parse(req.body);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new ApiError(status.BAD_REQUEST, "Invalid productId")
    }
    const existingProduct = await Product.findOne({ _id: productId, isDeleted: false }).session(session);
    if (!existingProduct) {
      throw new ApiError(status.NOT_FOUND, "Product not found")
    }

    const review = (await Review.create([{
      product: productId,
      user: userId,
      rating,
      comment
    }], { session }))[0];

    await updateProductRating(productId, session);

    await session.commitTransaction();

    // Invalidate reviews for this product (new review added, affects product reviews list)
    await redis.deleteByPattern(RedisPatterns.REVIEWS_BY_PRODUCT(String(review.product)));
    // Invalidate reviews by this user (new review added, affects user reviews list)
    await redis.deleteByPattern(RedisPatterns.REVIEWS_BY_USER(String(userId)));
    // Invalidate all review lists (new review added to lists)
    await redis.deleteByPattern(RedisPatterns.REVIEWS_ALL());
    // Invalidate product cache (product rating and reviewCount changed)
    await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(String(review.product)));
    // Invalidate all product lists (product lists display rating and reviewCount)
    await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
    // Invalidate user cache (user might have review count displayed)
    await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));
    // Invalidate dashboard stats (review count changed, might affect stats)
    await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());

    res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Review created successfully", review))
    return;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
})

export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const cacheKey = RedisKeys.REVIEWS_BY_PRODUCT(productId, req.query as Record<string, any>);
  const cachedReviews = await redis.get(cacheKey);

  if (cachedReviews) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "Reviews retrieved successfully", cachedReviews))
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid productId")
  }
  const existingProduct = await Product.findOne({ _id: productId, isDeleted: false });
  if (!existingProduct) {
    throw new ApiError(status.NOT_FOUND, "Product not found")
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [reviews, total] = await Promise.all([
    Review.find({ product: productId })
      .populate({ path: 'user', select: 'name email img', match: { isDeleted: false } })
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

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res.status(status.OK).json(new ApiResponse(status.OK, "Reviews retrieved successfully", result))
  return;
})

export const getAllReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, rating, user, product, search } = req.query;

  const cacheKey = RedisKeys.REVIEWS_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);

  if (cached)
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "All reviews retrieved successfully", cached));

  const filter: any = {};
  if (rating) filter.rating = Number(rating);

  if (user) {
    if (mongoose.Types.ObjectId.isValid(user as string)) {
      filter.user = new mongoose.Types.ObjectId(user as string);
    } else {
      const userRegex = new RegExp(user as string, 'i');

      const users = await User.find(
        {
          $or: [
            { name: { $regex: userRegex } },
            { email: { $regex: userRegex } },
            { phone: { $regex: userRegex } }
          ],
          isDeleted: false
        },
        { _id: 1 }
      );

      const userIds = users.map((u) => u._id);

      filter.user = userIds.length > 0 ? { $in: userIds } : [];
    }
}

  if (product) {
    if (mongoose.Types.ObjectId.isValid(product as string)) {
      filter.product = new mongoose.Types.ObjectId(product as string);
    } else {
      const productRegex = new RegExp(product as string, 'i');

      const products = await Product.find(
        {
          isDeleted: false,
          $or: [
            { name: { $regex: productRegex } },
            { tags: { $regex: productRegex } },
            { slug: { $regex: productRegex } }
          ]
        },
        { _id: 1 }
      );

      const ids = products.map((p) => p._id);

      filter.product = ids.length > 0 ? { $in: ids } : [];
    }
}

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];

  if (search) {
    pipeline.push({
      $search: {
        index: "review_search",
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
      pipeline: [
        { $project: { _id: 1, name: 1 } }
      ],
      as: "product"
    }
  });
  pipeline.push({
    $unwind: { path: "$product", preserveNullAndEmptyArrays: true }
  });

  const reviews = await Review.aggregate(pipeline);
  const total = await Review.countDocuments(filter);
  const totalPages = Math.ceil(total / Number(limit));

  const result = {
    reviews,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "All reviews retrieved successfully", result));
});

export const getMyReviews = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { page = 1, limit = 10 } = req.query;
  const cacheKey = RedisKeys.REVIEWS_BY_USER(userId, req.query as Record<string, any>);
  const cachedReviews = await redis.get(cacheKey);

  if (cachedReviews) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "Your reviews retrieved successfully", cachedReviews))
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [reviews, total] = await Promise.all([
    Review.find({ user: userId })
      .populate({ path: 'product', select: 'name thumbnail slug', match: { isDeleted: false } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Review.countDocuments({ user: userId })
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    reviews,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res.status(status.OK).json(new ApiResponse(status.OK, "Your reviews retrieved successfully", result))
  return;
})

export const updateReview = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const reviewId = req.params.id;
  const { rating, comment } = reviewValidation.partial().parse(req.body);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      throw new ApiError(status.BAD_REQUEST, "Invalid review ID")
    }
    const existingReview = await Review.findOne({ _id: reviewId, user: userId }).session(session);
    if (!existingReview) {
      throw new ApiError(status.NOT_FOUND, "Review not found or you are not authorized to update it")
    }
    existingReview.rating = rating ?? existingReview.rating;
    existingReview.comment = comment ?? existingReview.comment;
    await existingReview.save({ session });
    await updateProductRating(existingReview.product.toString(), session);

    await session.commitTransaction();

    // Invalidate this review's cache (review data changed)
    await redis.delete(RedisKeys.REVIEW_BY_ID(String(reviewId)));
    // Invalidate reviews for this product (review updated, affects product reviews list and rating)
    await redis.deleteByPattern(RedisPatterns.REVIEWS_BY_PRODUCT(String(existingReview.product)));
    // Invalidate reviews by this user (review updated, affects user reviews list)
    await redis.deleteByPattern(RedisPatterns.REVIEWS_BY_USER(String(userId)));
    // Invalidate all review lists (review data changed in lists)
    await redis.deleteByPattern(RedisPatterns.REVIEWS_ALL());
    // Invalidate product cache (product rating and reviewCount might have changed)
    await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(String(existingReview.product)));
    // Invalidate user cache (user might have review count displayed)
    await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));

    res.status(status.OK).json(new ApiResponse(status.OK, "Review updated successfully", existingReview))
    return;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
})

export const deleteReview = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const reviewId = req.params.id;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      throw new ApiError(status.BAD_REQUEST, "Invalid review ID")
    }
    const existingReview = await Review.findOne({ _id: reviewId, user: userId }).session(session);
    if (!existingReview) {
      throw new ApiError(status.NOT_FOUND, "Review not found or you are not authorized to delete it")
    }
    await existingReview.deleteOne({ session });

    await updateProductRating(existingReview.product.toString(), session);

    await session.commitTransaction();

    // Invalidate this review's cache (review data changed)
    await redis.delete(RedisKeys.REVIEW_BY_ID(String(reviewId)));
    // Invalidate reviews for this product (review updated, affects product reviews list and rating)
    await redis.deleteByPattern(RedisPatterns.REVIEWS_BY_PRODUCT(String(existingReview.product)));
    // Invalidate reviews by this user (review updated, affects user reviews list)
    await redis.deleteByPattern(RedisPatterns.REVIEWS_BY_USER(String(userId)));
    // Invalidate all review lists (review data changed in lists)
    await redis.deleteByPattern(RedisPatterns.REVIEWS_ALL());
    // Invalidate product cache (product rating and reviewCount might have changed)
    await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(String(existingReview.product)));
    // Invalidate user cache (user might have review count displayed)
    await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));

    res.status(status.OK).json(new ApiResponse(status.OK, "Review deleted successfully", existingReview))
    return;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
})