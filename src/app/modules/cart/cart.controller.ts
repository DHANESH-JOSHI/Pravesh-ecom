import { Cart } from './cart.model';
import mongoose, { Types } from 'mongoose';
import { Product } from '../product/product.model';
import { asyncHandler } from "@/utils";
import { CacheTTL } from "@/utils/cacheTTL";
import { RedisKeys } from "@/utils/redisKeys";
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { addToCartValidation, updateCartItemValidation } from './cart.validation';
import { IProduct } from '../product/product.interface';
import status from 'http-status';
import { redis } from '@/config/redis';
import { User } from '../user/user.model';
import { RedisPatterns } from '@/utils/redisKeys';
const ApiError = getApiErrorClass("CART");
const ApiResponse = getApiResponseClass("CART");

export const getCartById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = RedisKeys.CART_BY_ID(id);
  const cachedCart = await redis.get(cacheKey);
  if (cachedCart) {
    res.status(status.OK).json(new ApiResponse(status.OK, 'Cart retrieved successfully', cachedCart));
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid cart ID');
  }
  const cart = await Cart.findById(id).populate([
    {
      path: 'user',
      select: '_id name email',
      match: { isDeleted: false },
      populate: {
        path: 'wallet',
        select: 'balance'
      }
    },
    {
      path: 'items.product',
      select: '_id name thumbnail',
      populate: [
        {
          path: 'category',
          select: 'title _id',
          match: { isDeleted: false }
        },
        {
          path: 'brand',
          select: 'name _id',
          match: { isDeleted: false }
        }
      ]
    }
  ]).lean()
  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }
  const cartObj = (cart as any)?.toObject ? (cart as any).toObject() : cart;
  await redis.set(cacheKey, cartObj, CacheTTL.MEDIUM);
  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart retrieved successfully', cartObj));
  return;
});

export const getMyCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { populate = 'false' } = req.query;

  const cacheKey = RedisKeys.CART_BY_USER(userId, req.query as Record<string, any>);
  const cachedCart = await redis.get(cacheKey);
  if (cachedCart) {
    res.status(status.OK).json(new ApiResponse(status.OK, 'Cart retrieved successfully', cachedCart));
    return;
  }

  let cart;
  if (populate === 'true') {
    cart = await Cart.findOne({ user: userId }).populate({ path: 'items.product', match: { isDeleted: false } }).lean()
  } else {
    cart = await Cart.findOne({ user: userId }).lean()
  }

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  const cartObj = (cart as any)?.toObject ? (cart as any).toObject() : cart;
  await redis.set(cacheKey, cartObj, CacheTTL.MEDIUM);
  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart retrieved successfully', cartObj));
  return;
});

export const getAllCarts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, user } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const cacheKey = RedisKeys.CARTS_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);

  if (cached)
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Carts retrieved successfully", cached));

  const filter: any = {};

  if (user) {
    if (mongoose.Types.ObjectId.isValid(user as string)) {
      filter.user = new mongoose.Types.ObjectId(user as string);
    } else {
      const userRegex = new RegExp(user as string, 'i');
      const users = await User.find({
        $or: [
          { name: { $regex: userRegex } },
          { email: { $regex: userRegex } },
          { phone: { $regex: userRegex } },
        ]
      }, { _id: 1 });

      const userIds = users.map((u) => u._id);

      filter.user = userIds.length > 0 ? { $in: userIds } : [];
    }
}

const pipeline: any[] = [];

pipeline.push({ $match: filter });
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  pipeline.push({
    $lookup: {
      from: "users",
      localField: "user",
      foreignField: "_id",
      pipeline: [
        { $project: { _id: 1, name: 1, email: 1 } }
      ],
      as: "user"
    }
  });
  pipeline.push({
    $unwind: { path: "$user", preserveNullAndEmptyArrays: true }
  });

  pipeline.push({
    $lookup: {
      from: "products",
      localField: "items.product",
      foreignField: "_id",
      pipeline: [
        { $project: { _id: 1 } }
      ],
      as: "productData"
    }
  });

  pipeline.push({
    $addFields: {
      items: {
        $map: {
          input: "$items",
          as: "item",
          in: {
            product: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$productData",
                    cond: { $eq: ["$$item.product", "$$this._id"] }
                  }
                },
                0
              ]
            },
            quantity: "$$item.quantity",
            unit: "$$item.unit"
          }
        }
      }
    }
  });

  pipeline.push({ $project: { productData: 0 } });

  const carts = await Cart.aggregate(pipeline);
  const total = await Cart.countDocuments(filter);
  const totalPages = Math.ceil(total / Number(limit));

  const result = {
    carts,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Carts retrieved successfully", result));
});

export const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId, quantity, unit } = addToCartValidation.parse(req.body);

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
  });

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found or unavailable');
  }

  // Validate unit (required)
  const productUnits = product.units || [];
  if (productUnits.length === 0) {
    throw new ApiError(status.BAD_REQUEST, 'Product has no units defined');
  }
  const validUnit = productUnits.find(u => u.unit === unit);
  if (!validUnit) {
    throw new ApiError(status.BAD_REQUEST, `Invalid unit. Available units: ${productUnits.map(u => u.unit).join(', ')}`);
  }

  // if (product.stockStatus === StockStatus.OutOfStock) {
  //   throw new ApiError(status.BAD_REQUEST, 'Product is out of stock');
  // }

  // if (product.stock < quantity) {
  //   throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock`);
  // }

  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  await cart.addItem(productId, quantity, unit);

  const populatedCart = await Cart.findOne({ user: userId }).populate({ path: 'items.product', select: 'name thumbnail units', match: { isDeleted: false } });

  // Invalidate this cart's cache (cart item added, cart data changed)
  await redis.delete(RedisKeys.CART_BY_ID(String(cart._id)));
  // Invalidate this user's cart cache (cart item added)
  await redis.deleteByPattern(RedisPatterns.CART_BY_USER_ANY(String(userId)));
  // Invalidate this user's cart summary (cart summary changed)
  await redis.delete(RedisKeys.CART_SUMMARY_BY_USER(String(userId)));
  // Invalidate user cache (user might have cart count displayed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));

  res.status(status.OK).json(new ApiResponse(status.OK, 'Item added to cart successfully', populatedCart));
  return;
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = req.params;
  const { quantity, unit } = updateCartItemValidation.parse(req.body);

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }

  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
  });

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found or unavailable');
  }

  // Validate unit (required)
  const productUnits = product.units || [];
  if (productUnits.length === 0) {
    throw new ApiError(status.BAD_REQUEST, 'Product has no units defined');
  }
  const validUnit = productUnits.find(u => u.unit === unit);
  if (!validUnit) {
    throw new ApiError(status.BAD_REQUEST, `Invalid unit. Available units: ${productUnits.map(u => u.unit).join(', ')}`);
  }

  // if (product.stock < quantity) {
  //   throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock`);
  // }

  // Find the cart item with the specified unit
  const cartItem = cart.items.find(item => 
    item.product.equals(new Types.ObjectId(productId)) && item.unit === unit
  );

  try {
    // If item exists with this unit, update it
    if (cartItem) {
      await cart.updateItem(new Types.ObjectId(productId), quantity, unit);
    } else {
      // Item doesn't exist with this unit, add it as new item
      await cart.addItem(new Types.ObjectId(productId), quantity, unit);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Item not found in cart') {
      throw new ApiError(status.NOT_FOUND, 'Item not found in cart');
    }
    throw error;
  }

  const updatedCart = await Cart.findOne({ user: userId }).populate({ path: 'items.product', select: 'name thumbnail units', match: { isDeleted: false } });

  // Invalidate this cart's cache (cart item added, cart data changed)
  await redis.delete(RedisKeys.CART_BY_ID(String(cart._id)));
  // Invalidate this user's cart cache (cart item added)
  await redis.deleteByPattern(RedisPatterns.CART_BY_USER_ANY(String(userId)));
  // Invalidate this user's cart summary (cart summary changed)
  await redis.delete(RedisKeys.CART_SUMMARY_BY_USER(String(userId)));
  // Invalidate user cache (user might have cart count displayed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart item updated successfully', updatedCart));
  return;
});

export const removeFromCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = req.params;
  const { unit } = req.body; // Optional unit parameter - if not provided, removes all units of the product

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }

  // If unit is provided, validate it exists for the product and remove specific unit
  if (unit) {
    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    });
    if (product) {
      const productUnits = product.units || [];
      const validUnit = productUnits.find(u => u.unit === unit);
      if (!validUnit) {
        throw new ApiError(status.BAD_REQUEST, `Invalid unit. Available units: ${productUnits.map(u => u.unit).join(', ')}`);
      }
    }
    await cart.removeItem(new Types.ObjectId(productId), unit);
  } else {
    // If no unit provided, remove all items with this productId
    cart.items = cart.items.filter(item => !item.product.equals(new Types.ObjectId(productId)));
    await cart.save();
  }

  const updatedCart = await Cart.findOne({ user: userId }).populate({ path: 'items.product', select: 'name thumbnail units', match: { isDeleted: false } });

  // Invalidate this cart's cache (cart item added, cart data changed)
  await redis.delete(RedisKeys.CART_BY_ID(String(cart._id)));
  // Invalidate this user's cart cache (cart item added)
  await redis.deleteByPattern(RedisPatterns.CART_BY_USER_ANY(String(userId)));
  // Invalidate this user's cart summary (cart summary changed)
  await redis.delete(RedisKeys.CART_SUMMARY_BY_USER(String(userId)));
  // Invalidate user cache (user might have cart count displayed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));

  res.status(status.OK).json(new ApiResponse(status.OK, 'Item removed from cart successfully', updatedCart));
  return;
});

export const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }

  await cart.clearCart();

  // Invalidate this cart's cache (cart item added, cart data changed)
  await redis.delete(RedisKeys.CART_BY_ID(String(cart._id)));
  // Invalidate this user's cart cache (cart item added)
  await redis.deleteByPattern(RedisPatterns.CART_BY_USER_ANY(String(userId)));
  // Invalidate this user's cart summary (cart summary changed)
  await redis.delete(RedisKeys.CART_SUMMARY_BY_USER(String(userId)));
  // Invalidate user cache (user might have cart count displayed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart cleared successfully', {
    user: userId,
    items: [],
    totalItems: 0,
    itemCount: 0,
  }));
  return;
});

export const getCartSummary = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const cacheKey = RedisKeys.CART_SUMMARY_BY_USER(userId);
  const cachedSummary = await redis.get(cacheKey);
  if (cachedSummary) {
    res.status(status.OK).json(new ApiResponse(status.OK, 'Cart summary retrieved successfully', cachedSummary));
    return;
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    const summary = {
      totalItems: 0,
      itemCount: 0,
    };
    await redis.set(cacheKey, summary, CacheTTL.SHORT);
    res.status(status.OK).json(new ApiResponse(status.OK, 'Cart summary retrieved successfully', summary));
    return;
  }
  const { totalItems } = await cart.getCartSummary();

  const summary = {
    totalItems,
  };
  await redis.set(cacheKey, summary, CacheTTL.SHORT);

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart summary retrieved successfully', summary));
  return;
});

export const checkoutCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const cart = await Cart.findOne({ user: userId }).populate({ path: 'items.product', select: 'isDeleted status stock name', match: { isDeleted: false } });
  if (!cart || cart.items.length === 0) {
    throw new ApiError(status.BAD_REQUEST, 'Cart is empty');
  }
  for (const item of cart.items) {
    const product = item.product as unknown as IProduct;
    if (product.isDeleted) {
      throw new ApiError(status.BAD_REQUEST, `Product ${product.name} is not available`);
    }
    // if (item.quantity > product.stock) {
    //   throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock for product ${product.name}`);
    // }
  }

  // Invalidate this cart's cache (cart item added, cart data changed)
  await redis.delete(RedisKeys.CART_BY_ID(String(cart._id)));
  // Invalidate this user's cart cache (cart item added)
  await redis.deleteByPattern(RedisPatterns.CART_BY_USER_ANY(String(userId)));
  // Invalidate this user's cart summary (cart summary changed)
  await redis.delete(RedisKeys.CART_SUMMARY_BY_USER(String(userId)));
  // Invalidate user cache (user might have cart count displayed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));

  res.status(status.OK).json(new ApiResponse(status.OK, 'Checkout successful', {}));
  return;
})
