import { asyncHandler } from '@/utils';
import { redis } from '@/config/redis';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import status from 'http-status';
import { Wishlist } from './wishlist.model';
import { addOrRemoveProductValidation } from './wishlist.validation';
import { Product } from '../product/product.model';
import { Types } from 'mongoose';

const ApiError = getApiErrorClass('WISHLIST');
const ApiResponse = getApiResponseClass('WISHLIST');

export const getWishlist = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const cacheKey = `wishlist:${userId}`;
  const cachedWishlist = await redis.get(cacheKey);

  if (cachedWishlist) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'Wishlist retrieved successfully', cachedWishlist));
  }

  let wishlist = await Wishlist.findOne({ userId }).populate({
    path: 'items',
    match: { isDeleted: false },
  });

  if (!wishlist) {
    wishlist = await Wishlist.create({ userId, items: [] });
  }

  await redis.set(cacheKey, wishlist, 600);

  res.status(status.OK).json(new ApiResponse(status.OK, 'Wishlist retrieved successfully', wishlist));
  return;
});

export const addProductToWishlist = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = addOrRemoveProductValidation.parse(req.body);

  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found');
  }

  let wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, items: [productId] });
  } else {
    if (!wishlist.items.includes(product._id as Types.ObjectId)) {
      wishlist.items.push(product._id as Types.ObjectId);
      await wishlist.save();
    }
  }

  await redis.delete(`wishlist:${userId}`);

  res.status(status.OK).json(new ApiResponse(status.OK, `Product '${product.name}' added to wishlist`, wishlist));
  return;
});

export const removeProductFromWishlist = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = addOrRemoveProductValidation.parse(req.body);

  const wishlist = await Wishlist.findOne({ user: userId });

  if (!wishlist) {
    throw new ApiError(status.NOT_FOUND, 'Wishlist not found');
  }

  const initialLength = wishlist.items.length;
  wishlist.items = wishlist.items.filter(
    (id) => id.toString() !== productId.toString()
  );

  if (initialLength === wishlist.items.length) {
    throw new ApiError(status.NOT_FOUND, 'Product not found in wishlist');
  }

  await wishlist.save();

  await redis.delete(`wishlist:${userId}`);

  res.status(status.OK).json(new ApiResponse(status.OK, 'Product removed from wishlist successfully', wishlist));
  return;
});