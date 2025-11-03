import { asyncHandler, generateCacheKey } from '@/utils';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { Order } from './order.model';
import { Cart } from '../cart/cart.model';
import { Wallet } from '../wallet/wallet.model';
import { OrderStatus } from './order.interface';
import { checkoutFromCartValidation, adminUpdateOrderValidation } from './order.validation';
import mongoose, { Types } from 'mongoose';
import { Address } from '../address/address.model';
import status from 'http-status';
import { Product } from '../product/product.model';
import { redis } from '@/config/redis';
import { User } from '../user/user.model';
import { StockStatus } from '../product/product.interface';
const ApiError = getApiErrorClass("ORDER");
const ApiResponse = getApiResponseClass("ORDER");

export const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { shippingAddressId } = checkoutFromCartValidation.parse(req.body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const cart = await Cart.findOne({ user: userId }).session(session);
    if (!cart || cart.items.length === 0) {
      throw new ApiError(status.BAD_REQUEST, 'Your cart is empty');
    }

    let totalAmount = 0;
    for (const item of cart.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product || product.isDeleted) {
        throw new ApiError(status.BAD_REQUEST, `Product with ID ${item.product} is not available.`);
      }

      if (product.stockStatus === StockStatus.OutOfStock) {
        throw new ApiError(status.BAD_REQUEST, `product ${product.name} is out of stock`);
      }

      if (product.stock < item.quantity) {
        throw new ApiError(status.BAD_REQUEST, `Not enough stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }
      totalAmount += product.finalPrice * item.quantity;
    }

    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet || wallet.balance < totalAmount) {
      throw new ApiError(status.BAD_REQUEST, 'Insufficient wallet funds');
    }
    wallet.balance -= totalAmount;
    wallet.transactions.push({
      amount: -totalAmount,
      description: `Order payment`,
      createdAt: new Date(),
    });
    await wallet.save({ session });

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      }, { session });
    }

    const order = (await Order.create([{
      user: userId,
      items: cart.items,
      totalAmount,
      shippingAddress: shippingAddressId,
      status: OrderStatus.Processing,
    }], { session }))[0];

    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();

    await redis.deleteByPattern(`orders:user:${userId}*`);
    await redis.deleteByPattern('orders*');
    await redis.delete('dashboard:stats');

    res.status(status.CREATED).json(new ApiResponse(status.CREATED, 'Order placed successfully', order));
    return;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const createCustomOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!req.file) {
    throw new ApiError(status.BAD_REQUEST, 'An image is required for a custom order');
  }

  const customOrderImage = req.file.path;

  const order = await Order.create({
    user: userId,
    items: [],
    totalAmount: 0,
    shippingAddress: { street: 'N/A', city: 'N/A', state: 'N/A', postalCode: 'N/A', country: 'N/A' },
    status: OrderStatus.AwaitingConfirmation,
    isCustomOrder: true,
    image: customOrderImage,
  });

  await redis.deleteByPattern(`orders:user:${userId}*`);
  await redis.deleteByPattern('orders*');
  await redis.delete('dashboard:stats');

  res.status(status.CREATED).json(new ApiResponse(status.CREATED, 'Custom order request submitted successfully. An admin will review it shortly.', order));
  return;
});

export const updateOrder = asyncHandler(async (req, res) => {
  const { id: orderId } = req.params;
  const { items, status: orderStatus, feedback } = adminUpdateOrderValidation.parse(req.body);

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(status.NOT_FOUND, 'order not found');
  }
  let totalAmount = order.totalAmount;
  if (items && items.length > 0) {
    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.product)) {
        throw new ApiError(status.BAD_REQUEST, `Invalid product ID: ${item.product}`);
      }
      if (item.quantity <= 0) {
        throw new ApiError(status.BAD_REQUEST, 'Quantity must be a positive number');
      }
      const product = await Product.findById(item.product).select('finalPrice');
      if (!product) {
        throw new ApiError(status.NOT_FOUND, `Product not found: ${item.product}`);
      }
      totalAmount += product.finalPrice * item.quantity;
    }
    order.totalAmount = totalAmount;
    order.status = OrderStatus.AwaitingPayment;
  }
  if (orderStatus) order.status = orderStatus;
  if (feedback !== undefined) order.feedback = feedback;
  await order.save();

  await redis.delete(`order:${orderId}`);
  await redis.deleteByPattern(`orders:user:${order.user}*`);
  await redis.deleteByPattern('orders*');
  await redis.delete('dashboard:stats');

  res.status(status.OK).json(new ApiResponse(status.OK, 'Custom order updated successfully', order));
  return;
});

export const confirmCustomOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { id: orderId } = req.params;
  const { shippingAddressId } = checkoutFromCartValidation.parse(req.body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(shippingAddressId)) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid address ID');
    }
    const shippingAddress = await Address.findOne({ _id: shippingAddressId, user: userId, isDeleted: false }).session(session);
    if (!shippingAddress) {
      throw new ApiError(status.NOT_FOUND, 'Shipping address not found or you are not authorized to use it');
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid order ID');
    }
    const order = await Order.findOne({ _id: orderId, user: userId, isCustomOrder: true }).session(session);
    if (!order) {
      throw new ApiError(status.NOT_FOUND, 'Custom order not found or you are not authorized to confirm it');
    }

    if (order.status !== OrderStatus.AwaitingPayment) {
      throw new ApiError(status.BAD_REQUEST, 'This order is not awaiting payment.');
    }

    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet || wallet.balance < order.totalAmount) {
      throw new ApiError(status.BAD_REQUEST, 'Insufficient wallet funds');
    }

    wallet.balance -= order.totalAmount;
    wallet.transactions.push({
      amount: -order.totalAmount,
      description: `Payment for custom order #${order._id}`,
      createdAt: new Date(),
    });
    await wallet.save({ session });

    order.status = OrderStatus.Processing;
    order.shippingAddress = shippingAddress._id as Types.ObjectId;
    await order.save({ session });

    await session.commitTransaction();

    await redis.deleteByPattern(`orders:user:${userId}*`);
    await redis.delete(`order:${orderId}`);
    await redis.deleteByPattern('orders*');
    await redis.delete('dashboard:stats');

    res.status(status.OK).json(new ApiResponse(status.OK, 'Custom order confirmed and paid successfully', order));
    return;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});


export const getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const cacheKey = generateCacheKey(`orders:user:${userId}`, req.query);
  const cachedOrders = await redis.get(cacheKey);

  if (cachedOrders) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'Your orders retrieved successfully', cachedOrders));
  }

  const { populate = 'false', page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  let query = Order.find({ user: userId }).sort({ createdAt: -1 });
  if (populate === 'true') {
    query = query.populate('items.product shippingAddress');
  }
  const [orders, total] = await Promise.all([
    query.skip(skip).limit(Number(limit)),
    Order.countDocuments({ user: userId })
  ]);
  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    orders,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, 600);

  return res.status(status.OK).json(new ApiResponse(status.OK, 'Your orders retrieved successfully', result));
});


export const getOrderById = asyncHandler(async (req, res) => {
  const { id: orderId } = req.params;
  const cacheKey = `order:${orderId}`;
  const cachedOrder = await redis.get(cacheKey);

  if (cachedOrder) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'Order retrieved successfully', cachedOrder));
  }

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid order ID');
  }
  const order = await Order.findById(orderId).populate(
    [
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
        select: '_id name originalPrice finalPrice thumbnail',
        populate: [
          {
            path: 'category',
            select: '_id title'
          },
          {
            path: 'brand',
            select: '_id name'
          }
        ]
      },
      {
        path: 'shippingAddress',
      }
    ]
  )

  if (!order) {
    throw new ApiError(status.NOT_FOUND, 'Order not found');
  }

  await redis.set(cacheKey, order, 600);

  res.status(status.OK).json(new ApiResponse(status.OK, 'Order retrieved successfully', order));
  return;
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const cacheKey = generateCacheKey('orders', req.query);
  const cachedOrders = await redis.get(cacheKey);

  if (cachedOrders) {
    return res.status(status.OK).json(new ApiResponse(status.OK, 'All orders retrieved successfully', cachedOrders));
  }

  const { page = 1, limit = 10, status: orderStatus, user, isCustomOrder } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (orderStatus) filter.status = orderStatus;
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
  if (isCustomOrder !== undefined) filter.isCustomOrder = isCustomOrder === 'true';

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).populate('user', '_id name email').select('-items').skip(skip).limit(Number(limit)),
    Order.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    orders,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, 600);

  res.status(status.OK).json(new ApiResponse(status.OK, 'All orders retrieved successfully', result));
  return;
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id: orderId } = req.params;
  const { status: newStatus } = req.body as { status: OrderStatus };

  if (!Object.values(OrderStatus).includes(newStatus)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid order status');
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(status.NOT_FOUND, 'Order not found');
  }

  const oldStatus = order.status;
  order.status = newStatus;
  await order.save();

  if (newStatus === OrderStatus.Delivered && oldStatus !== OrderStatus.Delivered) {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product,
        {
          $inc: {
            salesCount: 1,
            totalSold: 1,
          }
        });
    }
    await redis.deleteByPattern('products:best-selling*');
    await redis.deleteByPattern('products:trending*');
    await redis.deleteByPattern('products*')
  }

  await redis.delete('dashboard:stats')
  await redis.deleteByPattern(`orders:user:${order.user}*`);
  await redis.deleteByPattern("orders*")
  await redis.delete(`order:${orderId}`)

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Order status updated successfully', order)
  );
  return;
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { id: orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(status.NOT_FOUND, 'Order not found');
  }
  if (order.user !== userId) {
    throw new ApiError(status.FORBIDDEN, 'You are not authorized to cancel this order');
  }
  if (order.status === OrderStatus.Shipped || order.status === OrderStatus.Delivered) {
    throw new ApiError(status.BAD_REQUEST, 'Order cannot be canceled after shipping');
  }

  order.status = OrderStatus.Cancelled;
  await order.save();

  await redis.deleteByPattern(`orders:user:${userId}*`);
  await redis.delete(`order:${orderId}`);
  await redis.deleteByPattern('orders*');
  await redis.delete('dashboard:stats');

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Order canceled successfully', order)
  );
  return;
});
