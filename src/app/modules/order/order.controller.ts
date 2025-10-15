import { asyncHandler } from '@/utils';
import { getApiErrorClass,getApiResponseClass } from '@/interface';
import { Order } from './order.model';
import { Cart } from '../cart/cart.model';
import { Wallet } from '../wallet/wallet.model';
import { OrderStatus } from './order.interface';
import { checkoutFromCartValidation, adminUpdateOrderValidation } from './order.validation';
const ApiError = getApiErrorClass("ORDER");
const ApiResponse = getApiResponseClass("ORDER");

export const checkoutFromCart = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }
  const { shippingAddress } = checkoutFromCartValidation.parse(req.body);

  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Your cart is empty');
  }

  const totalAmount = cart.totalPrice;

  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    // Create a wallet if it doesn't exist, though balance will be 0
    wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
  }
  if (!wallet || wallet.balance < totalAmount) {
    throw new ApiError(400, 'Insufficient wallet funds');
  }
  // Deduct from wallet
  wallet.balance -= totalAmount;
  wallet.transactions.push({
    amount: -totalAmount,
    description: `Order payment for cart checkout`,
    createdAt: new Date(),
  });
  await wallet.save();

  const order = await Order.create({
    user: userId,
    items: cart.items,
    totalAmount,
    shippingAddress,
    status: OrderStatus.Processing,
  });

  await cart.clearCart();

  res.status(201).json(new ApiResponse(201, 'Order placed successfully', order));
});


export const createCustomOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!req.file) {
    throw new ApiError(400, 'An image is required for a custom order');
  }

  const customOrderImage = req.file.path;

  const order = await Order.create({
    user: userId,
    items: [],
    totalAmount: 0,
    shippingAddress: { street: 'N/A', city: 'N/A', state: 'N/A', postalCode: 'N/A', country: 'N/A' },
    status: OrderStatus.AwaitingConfirmation,
    isCustomOrder: true,
    customOrderImage,
  });

  res.status(201).json(new ApiResponse(201, 'Custom order request submitted successfully. An admin will review it shortly.', order));
});

export const adminUpdateCustomOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { items, shippingAddress, status, feedback } = adminUpdateOrderValidation.parse(req.body);

  const order = await Order.findById(orderId);
  if (!order || !order.isCustomOrder) {
    throw new ApiError(404, 'Custom order not found');
  }
  //calculate total amount if items are provided
  let totalAmount = order.totalAmount;
  if (items && items.length > 0) {
    totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    order.items = items;
    order.totalAmount = totalAmount;
    if (!shippingAddress) {
      throw new ApiError(400, 'Shipping address is required for a custom order');
    }
    order.shippingAddress = shippingAddress;
    order.status = OrderStatus.AwaitingPayment;
  }
  if (status) order.status = status;
  if (feedback !== undefined) order.feedback = feedback;
  await order.save();

  res.status(200).json(new ApiResponse(200, 'Custom order updated successfully', order));
});

export const confirmCustomOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { orderId } = req.params;
  const order = await Order.findOne({ _id: orderId, user: userId, isCustomOrder: true });
  if (!order) {
    throw new ApiError(404, 'Custom order not found or you are not authorized to confirm it');
  }

  if (order.status !== OrderStatus.AwaitingPayment) {
    throw new ApiError(400, 'This order is not awaiting payment. It may not have been priced by an admin yet.');
  }

  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.balance < order.totalAmount) {
    throw new ApiError(400, 'Insufficient wallet funds');
  }
  // Deduct from wallet
  wallet.balance -= order.totalAmount;
  wallet.transactions.push({
    amount: -order.totalAmount,
    description: `Payment for custom order #${order._id}`,
    createdAt: new Date(),
  });
  await wallet.save();

  order.status = OrderStatus.Processing;

  await order.save();

  res.status(200).json(new ApiResponse(200, 'Custom order confirmed and paid successfully', order));
});


export const getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).populate('items.product');

  res.status(200).json(new ApiResponse(200, 'Your orders retrieved successfully', orders));
});


export const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId).populate('user', 'name email').populate('items.product');

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  // Optional: Add check to ensure only the user who placed the order or an admin can view it
  if (req.user?.role !== 'admin' && order.user.toString() !== req.user?._id) {
    throw new ApiError(403, 'You are not authorized to view this order');
  }

  res.status(200).json(new ApiResponse(200, 'Order retrieved successfully', order));
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).sort({ createdAt: -1 }).populate('user', 'name email');
  res.status(200).json(new ApiResponse(200, 'All orders retrieved successfully', orders));
});
