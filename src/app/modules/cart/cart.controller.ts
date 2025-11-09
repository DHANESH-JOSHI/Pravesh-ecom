import { Cart } from './cart.model';
import mongoose, { Types } from 'mongoose';
import { Product } from '../product/product.model';
import { asyncHandler, generateCacheKey } from '@/utils';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { addToCartValidation, updateCartItemValidation } from './cart.validation';
import { IProduct, StockStatus } from '../product/product.interface';
import status from 'http-status';
import { redis } from '@/config/redis';
import { User } from '../user/user.model';
const ApiError = getApiErrorClass("CART");
const ApiResponse = getApiResponseClass("CART");

export const getCartById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = `cart:id:${id}`;
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
      populate: {
        path: 'wallet',
        select: 'balance'
      }
    },
    {
      path: 'items.product',
      select: '_id name thumbnail originalPrice finalPrice',
      populate: [
        {
          path: 'category',
          select: 'title _id'
        },
        {
          path: 'brand',
          select: 'name _id'
        }
      ]
    }
  ])
  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }
  await redis.set(cacheKey, cart, 900);
  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart retrieved successfully', cart));
  return;
});

export const getMyCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { populate = 'false' } = req.query;

  const cacheKey = generateCacheKey(`cart:user:${userId}`, req.query);
  const cachedCart = await redis.get(cacheKey);
  if (cachedCart) {
    res.status(status.OK).json(new ApiResponse(status.OK, 'Cart retrieved successfully', cachedCart));
    return;
  }

  let cart;
  if (populate === 'true') {
    cart = await Cart.findOne({ user: userId }).populate('items.product')
  } else {
    cart = await Cart.findOne({ user: userId });
  }

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  await redis.set(cacheKey, cart, 900);
  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart retrieved successfully', cart));
  return;
});

export const getAllCarts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, user } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const cacheKey = generateCacheKey('carts', req.query);
  const cachedResult = await redis.get(cacheKey);
  if (cachedResult) {
    res.status(status.OK).json(new ApiResponse(status.OK, 'Carts retrieved successfully', cachedResult));
    return;
  }

  const filter: any = {};
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

  const cartsQuery = Cart.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit)).populate('user', '_id name email').populate('items.product', 'finalPrice');
  const [carts, total] = await Promise.all([
    cartsQuery,
    Cart.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    carts,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, 600);
  res.status(status.OK).json(new ApiResponse(status.OK, 'Carts retrieved successfully', result));
  return;
});

export const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId, quantity } = addToCartValidation.parse(req.body);

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

  if (product.stockStatus === StockStatus.OutOfStock) {
    throw new ApiError(status.BAD_REQUEST, 'Product is out of stock');
  }

  if (product.stock < quantity) {
    throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock`);
  }

  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  await cart.addItem(productId, quantity);

  const populatedCart = await Cart.findOne({ user: userId }).populate('items.product', 'name price thumbnail');

  await redis.deleteByPattern(`cart:user:${userId}*`);
  await redis.delete(`cart:summary:${userId}`);
  await redis.deleteByPattern('carts*');
  await redis.delete(`cart:id:${cart._id}`);

  res.status(status.OK).json(new ApiResponse(status.OK, 'Item added to cart successfully', populatedCart));
  return;
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = req.params;
  const { quantity } = updateCartItemValidation.parse(req.body);

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

  if (product.stock < quantity) {
    throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock`);
  }

  try {
    await cart.updateItem(new Types.ObjectId(productId), quantity);
  } catch (error) {
    if (error instanceof Error && error.message === 'Item not found in cart') {
      throw new ApiError(status.NOT_FOUND, 'Item not found in cart');
    }
    throw error;
  }

  const updatedCart = await Cart.findOne({ user: userId }).populate('items.product', 'name price thumbnail');

  await redis.deleteByPattern(`cart:user:${userId}*`);
  await redis.delete(`cart:summary:${userId}`);
  await redis.deleteByPattern('carts*');
  await redis.delete(`cart:id:${cart._id}`);

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart item updated successfully', updatedCart));
  return;
});

export const removeFromCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }

  await cart.removeItem(new Types.ObjectId(productId));

  const updatedCart = await Cart.findOne({ user: userId }).populate('items.product', 'name price thumbnail');

  await redis.deleteByPattern(`cart:user:${userId}*`);
  await redis.delete(`cart:summary:${userId}`);
  await redis.deleteByPattern('carts*');
  await redis.delete(`cart:id:${cart._id}`);

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

  await redis.deleteByPattern(`cart:user:${userId}*`);
  await redis.delete(`cart:summary:${userId}`);
  await redis.deleteByPattern('carts*');
  await redis.delete(`cart:id:${cart._id}`);

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart cleared successfully', {
    user: userId,
    items: [],
    totalItems: 0,
    totalPrice: 0,
    itemCount: 0,
  }));
  return;
});

export const getCartSummary = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const cacheKey = `cart:summary:${userId}`;
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
    await redis.set(cacheKey, summary, 600);
    res.status(status.OK).json(new ApiResponse(status.OK, 'Cart summary retrieved successfully', summary));
    return;
  }
  const { totalItems, totalPrice } = await cart.getCartSummary();

  const summary = {
    totalItems,
    totalPrice,
  };
  await redis.set(cacheKey, summary, 600);

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart summary retrieved successfully', summary));
  return;
});

export const checkoutCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const cart = await Cart.findOne({ user: userId }).populate('items.product', 'finalPrice isDeleted status stock name');
  if (!cart || cart.items.length === 0) {
    throw new ApiError(status.BAD_REQUEST, 'Cart is empty');
  }
  let totalPrice = 0;
  for (const item of cart.items) {
    const product = item.product as unknown as IProduct;
    if (product.isDeleted) {
      throw new ApiError(status.BAD_REQUEST, `Product ${product.name} is not available`);
    }
    if (item.quantity > product.stock) {
      throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock for product ${product.name}`);
    }
    totalPrice += item.quantity * product.finalPrice
  }

  await redis.deleteByPattern(`cart:user:${userId}*`);
  await redis.delete(`cart:summary:${userId}`);
  await redis.deleteByPattern('carts*');
  await redis.delete(`cart:id:${cart._id}`);

  res.status(status.OK).json(new ApiResponse(status.OK, 'Checkout successful', { totalPrice }));
  return;
})
