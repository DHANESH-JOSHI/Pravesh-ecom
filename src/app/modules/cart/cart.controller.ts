import { Cart } from './cart.model';
import mongoose, { Types } from 'mongoose';
import { Product } from '../product/product.model';
import { asyncHandler } from '@/utils';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { addToCartValidation, updateCartItemValidation } from './cart.validation';
import { IProduct } from '../product/product.interface';
import status from 'http-status';
const ApiError = getApiErrorClass("CART");
const ApiResponse = getApiResponseClass("CART");

export const getMyCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { populate = 'false' } = req.query;

  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'User not authenticated');
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
  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart retrieved successfully', cart));
});

export const getAllCarts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, populate = 'false', user } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (user) filter.user = user;

  let cartsQuery = Cart.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  if (populate === 'true') {
    cartsQuery = cartsQuery.populate('user', 'name email').populate('items.product', 'name finalPrice thumbnail');
  }

  const [carts, total] = await Promise.all([
    cartsQuery,
    Cart.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / Number(limit));
  res.status(status.OK).json(new ApiResponse(status.OK, 'Carts retrieved successfully', {
    carts,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  }));
});

export const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId, quantity } = addToCartValidation.parse(req.body);

  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'User not authenticated');
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    status: 'active'
  });

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found or unavailable');
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

  res.status(status.OK).json(new ApiResponse(status.OK, 'Item added to cart successfully', populatedCart));
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
    status: 'active'
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

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart item updated successfully', updatedCart));
});

export const removeFromCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = req.params;

  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'User not authenticated');
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }

  await cart.removeItem(new Types.ObjectId(productId));

  const updatedCart = await Cart.findOne({ user: userId }).populate('items.product', 'name price thumbnail');

  res.status(status.OK).json(new ApiResponse(status.OK, 'Item removed from cart successfully', updatedCart));
});

export const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'User not authenticated');
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }

  await cart.clearCart();

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart cleared successfully', {
    user: userId,
    items: [],
    totalItems: 0,
    totalPrice: 0,
    itemCount: 0,
  }));
});

export const getCartSummary = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'User not authenticated');
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    res.status(status.OK).json(new ApiResponse(status.OK, 'Cart summary retrieved successfully', {
      totalItems: 0,
      itemCount: 0,
    }));
    return;
  }
  const { totalItems, totalPrice } = await cart.getCartSummary();

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart summary retrieved successfully', {
    totalItems,
    totalPrice,
  }));
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
    if (product.isDeleted || product.status !== 'active') {
      throw new ApiError(status.BAD_REQUEST, `Product ${product.name} is not available`);
    }
    if (item.quantity > product.stock) {
      throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock for product ${product.name}`);
    }
    totalPrice += item.quantity * product.finalPrice
  }
  res.status(status.OK).json(new ApiResponse(status.OK, 'Checkout successful', { totalPrice }));
})
