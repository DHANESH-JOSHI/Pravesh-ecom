import { Cart } from './cart.model'; // This should be from './cart.model'
import mongoose, { Types } from 'mongoose';
import { Product } from '../product/product.model';
import { asyncHandler } from '@/utils';
import { ApiError, ApiResponse } from '@/interface';
import { addToCartValidation, updateCartItemValidation } from './cart.validation';

// Get user's cart
export const getCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { populate = 'true' } = req.query;

  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
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
  res.status(200).json(new ApiResponse(200, 'Cart retrieved successfully', cart));
});

// Add item to cart
export const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId, quantity, selectedColor, selectedSize } = addToCartValidation.parse(req.body);

  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  // Check if product exists and is available
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    status: 'active'
  });

  if (!product) {
    throw new ApiError(404, 'Product not found or unavailable');
  }

  // Check stock availability
  if (product.inventory.stock < quantity) {
    throw new ApiError(400, `Only ${product.inventory.stock} items available in stock`);
  }
  // Check if selected color/size is available
  if (selectedColor) { // The product's colors are now a string[]
    const availableColors = product.specifications?.get('colors') || [];
    if (!availableColors.includes(selectedColor)) {
      throw new ApiError(400, 'Selected color is not available');
    }
  }
  if (selectedSize) { // The product's sizes are now a string[]
    const availableSizes = product.specifications?.get('sizes') || [];
    if (!availableSizes.includes(selectedSize)) {
      throw new ApiError(400, 'Selected size is not available');
    }
  }

  // Find or create user's cart
  let cart = await Cart.findOne({ user: userId });

  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  // Add item to cart
  await cart.addItem(productId, quantity, product.finalPrice!, selectedColor, selectedSize);

  // Populate the cart with product details
  const populatedCart = await Cart.findOne({ user: userId }).populate('items.product');

  res.status(200).json(new ApiResponse(200, 'Item added to cart successfully', populatedCart));
});

// Update cart item quantity
export const updateCartItem = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = req.params;
  const { quantity, selectedColor, selectedSize } = updateCartItemValidation.parse(req.body);

  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  // Find user's cart
  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }

  // Check if product exists and is available
  const product = await Product.findOne({
    _id: productId,
    isDeleted: false,
    status: 'active'
  });

  if (!product) {
    throw new ApiError(404, 'Product not found or unavailable');
  }

  // Check stock availability
  if (product.inventory.stock < quantity) {
    throw new ApiError(400, `Only ${product.inventory.stock} items available in stock`);
  }

  // Update item in cart
  try {
    await cart.updateItem(new Types.ObjectId(productId), quantity, selectedColor, selectedSize);
  } catch (error) {
    if (error instanceof Error && error.message === 'Item not found in cart') {
      throw new ApiError(404, 'Item not found in cart');
    }
    throw error;
  }

  // Get updated cart with populated data
  const updatedCart = await Cart.findOne({ user: userId }).populate('items.product');

  res.status(200).json(new ApiResponse(200, 'Cart item updated successfully', updatedCart));
});

// Remove item from cart
export const removeFromCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { productId } = req.params;
  const { selectedColor, selectedSize } = req.query;

  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new ApiError(400, 'Invalid product ID');
  }

  // Find user's cart
  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }

  // Remove item from cart
  await cart.removeItem(new Types.ObjectId(productId), selectedColor as string, selectedSize as string);

  // Get updated cart with populated data
  const updatedCart = await Cart.findOne({ user: userId }).populate('items.product');

  res.status(200).json(new ApiResponse(200, 'Item removed from cart successfully', updatedCart));
});

// Clear entire cart
export const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }

  // Find user's cart
  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    throw new ApiError(404, 'Cart not found');
  }

  // Clear all items from cart
  await cart.clearCart();

  res.status(200).json(new ApiResponse(200, 'Cart cleared successfully', {
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
    throw new ApiError(401, 'User not authenticated');
  }

  const cart = await Cart.findOne({ user: userId });

  if (!cart) {
    res.status(200).json(new ApiResponse(200, 'Cart summary retrieved successfully', {
      totalItems: 0,
      totalPrice: 0,
      itemCount: 0,
    }));
    return;
  }

  res.status(200).json(new ApiResponse(200, 'Cart summary retrieved successfully', {
    totalItems: cart.totalItems,
    totalPrice: cart.totalPrice,
    itemCount: cart.items.length,
  }));
});
