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

const updateProductRating = async (productId: mongoose.Types.ObjectId, session?: mongoose.ClientSession) => {
  const stats = await Review.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: '$product',
        reviewCount: { $sum: 1 },
        rating: { $avg: '$rating' }
      }
    }
  ]);

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
    const existingProduct = await Product.findOne({ _id: productId, isDeleted: false, status: 'active' }).session(session);
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
    await redis.deleteByPattern('reviews*');
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

  await redis.set(cacheKey, result, 600);

  res.status(status.OK).json(new ApiResponse(status.OK, "Reviews retrieved successfully", result))
  return;
})


export const getAllReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, rating, user, product, search } = req.query;
  const cacheKey = generateCacheKey('reviews', req.query);
  const cachedReviews = await redis.get(cacheKey);

  if (cachedReviews) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "All reviews retrieved successfully", cachedReviews))
  }

  const filter: any = {};
  if (rating) filter.rating = Number(rating);

  if (user) {
    if (mongoose.Types.ObjectId.isValid(user as string)) {
      filter.user = user;
    } else {
      const users = await User.find({
        $or: [
          { name: { $regex: user, $options: 'i' } },
          { email: { $regex: user, $options: 'i' } },
          { phone: { $regex: user, $options: 'i' } }
        ]
      }).select('_id');

      const userIds = users.map(u => u._id);
      filter.user = { $in: userIds };
    }
  }

  if (product) {
    if (mongoose.Types.ObjectId.isValid(product as string)) {
      filter.product = product;
    } else {
      const products = await Product.find({ name: { $regex: product, $options: 'i' } }).select('_id');
      const productIds = products.map(p => p._id);
      filter.product = { $in: productIds };
    }
  }

  if (search) filter.comment = { $regex: search, $options: 'i' };

  const skip = (Number(page) - 1) * Number(limit);
  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('user', 'name email')
      .populate('product', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Review.countDocuments(filter)
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

  res.status(status.OK).json(new ApiResponse(status.OK, "All reviews retrieved successfully", result))
  return;
})

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

    await updateProductRating(existingReview.product, session);

    await session.commitTransaction();

    await redis.deleteByPattern(`reviews:product:${existingReview.product}*`);
    await redis.deleteByPattern('reviews*');
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

    await updateProductRating(existingReview.product, session);

    await session.commitTransaction();

    await redis.deleteByPattern(`reviews:product:${existingReview.product}*`);
    await redis.deleteByPattern('reviews*');
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