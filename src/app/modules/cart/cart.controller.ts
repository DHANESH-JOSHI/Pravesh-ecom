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
  const { productId, quantity, unit, variantSelections } = addToCartValidation.parse(req.body);

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
  }).populate('units', 'name');

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found or unavailable');
  }

  // Validate unit (required)
  const productUnits = product.units || [];
  if (productUnits.length === 0) {
    throw new ApiError(status.BAD_REQUEST, 'Product has no units defined');
  }
  // Check if the provided unit string matches any unit name
  const validUnit = productUnits.find((u: any) => {
    const unitName = typeof u === 'object' && u !== null ? u.name : String(u);
    return unitName === unit;
  });
  if (!validUnit) {
    const unitNames = productUnits.map((u: any) => {
      return typeof u === 'object' && u !== null ? u.name : String(u);
    });
    throw new ApiError(status.BAD_REQUEST, `Invalid unit. Available units: ${unitNames.join(', ')}`);
  }

  // Validate variant selections if provided
  if (variantSelections && Object.keys(variantSelections).length > 0) {
    const productVariants = product.variants || {};
    for (const [variantKey, selectedValue] of Object.entries(variantSelections)) {
      if (!productVariants[variantKey]) {
        throw new ApiError(status.BAD_REQUEST, `Variant "${variantKey}" is not available for this product`);
      }
      const availableValues = productVariants[variantKey];
      if (!Array.isArray(availableValues) || !availableValues.includes(selectedValue)) {
        throw new ApiError(status.BAD_REQUEST, `Invalid value "${selectedValue}" for variant "${variantKey}". Available: ${availableValues.join(', ')}`);
      }
    }
  }

  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  await cart.addItem(productId, quantity, unit, variantSelections);

  const populatedCart = await Cart.findOne({ user: userId }).populate({ 
    path: 'items.product', 
    select: 'name thumbnail units', 
    match: { isDeleted: false },
    populate: { path: 'units', select: 'name', match: { isDeleted: false } }
  });

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
  const { quantity, unit, variantSelections } = updateCartItemValidation.parse(req.body);

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
  }).populate('units', 'name');

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found or unavailable');
  }

  // Validate unit (required)
  const productUnits = product.units || [];
  if (productUnits.length === 0) {
    throw new ApiError(status.BAD_REQUEST, 'Product has no units defined');
  }
  // Check if the provided unit string matches any unit name
  const validUnit = productUnits.find((u: any) => {
    const unitName = typeof u === 'object' && u !== null ? u.name : String(u);
    return unitName === unit;
  });
  if (!validUnit) {
    const unitNames = productUnits.map((u: any) => {
      return typeof u === 'object' && u !== null ? u.name : String(u);
    });
    throw new ApiError(status.BAD_REQUEST, `Invalid unit. Available units: ${unitNames.join(', ')}`);
  }

  // Validate variant selections if provided
  if (variantSelections && Object.keys(variantSelections).length > 0) {
    const productVariants = product.variants || {};
    for (const [variantKey, selectedValue] of Object.entries(variantSelections)) {
      if (!productVariants[variantKey]) {
        throw new ApiError(status.BAD_REQUEST, `Variant "${variantKey}" is not available for this product`);
      }
      const availableValues = productVariants[variantKey];
      if (!Array.isArray(availableValues) || !availableValues.includes(selectedValue)) {
        throw new ApiError(status.BAD_REQUEST, `Invalid value "${selectedValue}" for variant "${variantKey}". Available: ${availableValues.join(', ')}`);
      }
    }
  }

  // Helper function to compare variant selections
  const areVariantsEqual = (v1: Record<string, string> | undefined, v2: Record<string, string> | undefined): boolean => {
    if (!v1 && !v2) return true;
    if (!v1 || !v2) return false;
    const keys1 = Object.keys(v1).sort();
    const keys2 = Object.keys(v2).sort();
    if (keys1.length !== keys2.length) return false;
    return keys1.every(key => v1[key] === v2[key]);
  };

  // Find the cart item with the specified unit and variant selections
  const cartItem = cart.items.find(item => 
    item.product.equals(new Types.ObjectId(productId)) && 
    item.unit === unit &&
    areVariantsEqual(item.variantSelections, variantSelections)
  );

  try {
    // If item exists with this unit and variants, update it
    if (cartItem) {
      await cart.updateItem(new Types.ObjectId(productId), quantity, unit, variantSelections);
    } else {
      // Item doesn't exist with this combination, add it as new item
      await cart.addItem(new Types.ObjectId(productId), quantity, unit, variantSelections);
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
  const { unit, variantSelections } = req.body; // Optional unit and variantSelections - if not provided, removes all items of the product

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }

  // If unit is provided, validate it exists for the product and remove specific unit+variants combination
  if (unit) {
    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    }).populate('units', 'name');
    if (product) {
      const productUnits = product.units || [];
      // Check if the provided unit string matches any unit name
      const validUnit = productUnits.find((u: any) => {
        const unitName = typeof u === 'object' && u !== null ? u.name : String(u);
        return unitName === unit;
      });
      if (!validUnit) {
        const unitNames = productUnits.map((u: any) => {
          return typeof u === 'object' && u !== null ? u.name : String(u);
        });
        throw new ApiError(status.BAD_REQUEST, `Invalid unit. Available units: ${unitNames.join(', ')}`);
      }
    }
    await cart.removeItem(new Types.ObjectId(productId), unit, variantSelections);
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
