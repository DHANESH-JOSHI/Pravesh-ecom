import { Cart } from './cart.model'; // This should be from './cart.model'
import mongoose, { Types } from 'mongoose';
import { Product } from '../product/product.model';
import { asyncHandler } from '@/utils';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { addToCartValidation, updateCartItemValidation } from './cart.validation';
import { IProduct } from '../product/product.interface';
import status from 'http-status';
const ApiError = getApiErrorClass("CART");
const ApiResponse = getApiResponseClass("CART");
// Get user's cart
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
    // Create empty cart if doesn't exist
    cart = await Cart.create({ user: userId, items: [] });
  }
  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart retrieved successfully', cart));
});

export const getAllCarts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, populate = 'false' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  let cartsQuery = Cart.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  if (populate === 'true') {
    cartsQuery = cartsQuery.populate('user', 'name email').populate('items.product', 'name finalPrice thumbnail');
  }

  const [carts, total] = await Promise.all([
    cartsQuery,
    Cart.countDocuments(),
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

// Add item to cart
export const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId, quantity } = addToCartValidation.parse(req.body);

  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'User not authenticated');
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  // Check if product exists and is available
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    status: 'active'
  });

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found or unavailable');
  }

  // Check stock availability
  if (product.stock < quantity) {
    throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock`);
  }

  // Find or create user's cart
  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  // Add item to cart
  await cart.addItem(productId, quantity);

  // Populate the cart with product details
  const populatedCart = await Cart.findOne({ user: userId }).populate('items.product', 'name price thumbnail');

  res.status(status.OK).json(new ApiResponse(status.OK, 'Item added to cart successfully', populatedCart));
});

// Update cart item quantity
export const updateCartItem = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = req.params;
  const { quantity } = updateCartItemValidation.parse(req.body);

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  // Find user's cart
  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }

  // Check if product exists and is available
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    status: 'active'
  });

  if (!product) {
    throw new ApiError(status.NOT_FOUND, 'Product not found or unavailable');
  }

  // Check stock availability
  if (product.stock < quantity) {
    throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock`);
  }

  // Update item in cart
  try {
    await cart.updateItem(new Types.ObjectId(productId), quantity);
  } catch (error) {
    if (error instanceof Error && error.message === 'Item not found in cart') {
      throw new ApiError(status.NOT_FOUND, 'Item not found in cart');
    }
    throw error;
  }

  // Get updated cart with populated data
  const updatedCart = await Cart.findOne({ user: userId }).populate('items.product', 'name price thumbnail');

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart item updated successfully', updatedCart));
});

// Remove item from cart
export const removeFromCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = req.params;

  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'User not authenticated');
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid product ID');
  }

  // Find user's cart
  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }

  // Remove item from cart
  await cart.removeItem(new Types.ObjectId(productId));

  // Get updated cart with populated data
  const updatedCart = await Cart.findOne({ user: userId }).populate('items.product', 'name price thumbnail');

  res.status(status.OK).json(new ApiResponse(status.OK, 'Item removed from cart successfully', updatedCart));
});

// Clear entire cart
export const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'User not authenticated');
  }

  // Find user's cart
  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(status.NOT_FOUND, 'Cart not found');
  }

  // Clear all items from cart
  await cart.clearCart();

  res.status(status.OK).json(new ApiResponse(status.OK, 'Cart cleared successfully', {
    user: userId,
    items: [],
    totalItems: 0,
    totalPrice: 0,
    itemCount: 0,
  }));
});

// Get cart summary (lightweight version)
export const getCartSummary = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'User not authenticated');
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    res.status(status.OK).json(new ApiResponse(status.OK, 'Cart summary retrieved successfully', {
      totalItems: 0, // total quantity of all products
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
  // check stock for each item and calculate total price
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
