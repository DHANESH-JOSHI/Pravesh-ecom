import { asyncHandler, generateCacheKey } from "@/utils";
import { reviewValidation } from "./review.validation";
import mongoose from "mongoose";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import status from "http-status";
import { Product } from "../product/product.model";
import { User } from "../user/user.model";
import { Review } from "./review.model";
import { redis } from "@/config/redis";
const ApiError = getApiErrorClass("REVIEW")
const ApiResponse = getApiResponseClass("REVIEW")

const updateProductRating = async (productId: string, session: mongoose.ClientSession) => {
  const stats = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
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

  await Product.findByIdAndUpdate(productId, {
    reviewCount,
    rating
  }, { session });

  await redis.deleteByPattern(`product:${productId}*`);
  return;
};

export const getReviewById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = `review:${id}`;
  const cachedReview = await redis.get(cacheKey);

  if (cachedReview) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'Review retrieved successfully', cachedReview));
  }

  const review = await Review.findById(id).populate('user', 'name email').populate('product', 'name');

  if (!review) {
    throw new ApiError(status.NOT_FOUND, "Review not found");
  }

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

    await redis.deleteByPattern(`reviews:product:${productId}*`);
    await redis.deleteByPattern(`reviews:user:${userId}*`);
    await redis.delete(`product:${review.product}?populate=true`);
    await redis.delete(`user:${userId}?populate=true`);
    await redis.deleteByPattern('reviews:all*');
    await redis.deleteByPattern(`reviews:user:${userId}*`);

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
  const cacheKey = generateCacheKey(`reviews:product:${productId}`, req.query);
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
      .populate('user', 'name email img')
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

  await redis.set(cacheKey, result, 600);

  res.status(status.OK).json(new ApiResponse(status.OK, "Reviews retrieved successfully", result))
  return;
})

export const getAllReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, rating, user, product, search } = req.query;

  const cacheKey = generateCacheKey("reviews:all", req.query);
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
      const users = await User.aggregate([
        {
          $search: {
            index: "user_search",
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
    if (mongoose.Types.ObjectId.isValid(product as string)) {
      filter.product = new mongoose.Types.ObjectId(product as string);
    } else {
      const products = await Product.aggregate([
        {
          $search: {
            index: "product_search",
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
      pipeline: [{ $project: { _id: 1, name: 1 } }],
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

  await redis.set(cacheKey, result, 600);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "All reviews retrieved successfully", result));
});

export const getMyReviews = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { page = 1, limit = 10 } = req.query;
  const cacheKey = generateCacheKey(`reviews:user:${userId}`, req.query);
  const cachedReviews = await redis.get(cacheKey);

  if (cachedReviews) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "Your reviews retrieved successfully", cachedReviews))
  }

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
  const result = {
    reviews,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, 600);

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

    await redis.delete(`review:${reviewId}`);
    await redis.deleteByPattern(`reviews:product:${existingReview.product.toString()}*`);
    await redis.delete(`product:${existingReview.product.toString()}?populate=true`);
    await redis.delete(`user:${userId}?populate=true`);
    await redis.deleteByPattern('reviews:all*');
    await redis.deleteByPattern(`reviews:user:${userId}*`);

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

    await redis.delete(`review:${reviewId}`);
    await redis.deleteByPattern(`reviews:product:${existingReview.product.toString()}*`);
    await redis.delete(`product:${existingReview.product.toString()}?populate=true`);
    await redis.delete(`user:${userId}?populate=true`);
    await redis.deleteByPattern('reviews:all*');
    await redis.deleteByPattern(`reviews:user:${userId}*`);

    res.status(status.OK).json(new ApiResponse(status.OK, "Review deleted successfully", existingReview))
    return;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
})