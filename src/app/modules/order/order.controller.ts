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
// import { StockStatus } from '../product/product.interface';
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
    const orderItems = []
    let totalAmount = 0;
    for (const item of cart.items) {
      const product = await Product.findById(item.product).session(session);
      if (!product || product.isDeleted) {
        throw new ApiError(status.BAD_REQUEST, `Product with ID ${item.product} is not available.`);
      }

      // if (product.stockStatus === StockStatus.OutOfStock) {
      //   throw new ApiError(status.BAD_REQUEST, `product ${product.name} is out of stock`);
      // }

      // if (product.stock < item.quantity) {
      //   throw new ApiError(status.BAD_REQUEST, `Not enough stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      // }
      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.originalPrice
      });
      totalAmount += product.originalPrice * item.quantity;
    }

    // const wallet = await Wallet.findOne({ user: userId }).session(session);
    // if (!wallet || wallet.balance < totalAmount) {
    //   throw new ApiError(status.BAD_REQUEST, 'Insufficient wallet funds');
    // }
    // wallet.balance -= totalAmount;
    // wallet.transactions.push({
    //   amount: -totalAmount,
    //   description: `Order payment`,
    //   createdAt: new Date(),
    // });
    // await wallet.save({ session });

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      }, { session });
    }
    const order = (await Order.create([{
      user: userId,
      items: orderItems,
      totalAmount,
      shippingAddress: shippingAddressId,
      status: OrderStatus.Received,
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
    status: OrderStatus.Received,
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
  const { items, feedback } = adminUpdateOrderValidation.parse(req.body);

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
      const product = await Product.findById(item.product).select('originalPrice');
      if (!product) {
        throw new ApiError(status.NOT_FOUND, `Product not found: ${item.product}`);
      }
      totalAmount += product.originalPrice * item.quantity;
    }
    order.totalAmount = totalAmount;
    // order.status = OrderStatus.Approved;
  }
  // if (orderStatus) {
  //   if ([OrderStatus.Approved, OrderStatus.Cancelled, OrderStatus.Confirmed].includes(orderStatus)) {
  //     order.status = orderStatus;
  //   } else {
  //     throw new ApiError(status.BAD_REQUEST, 'You can only update the status to Approved, Cancelled, or Confirmed as of now');
  //   }
  // }
  if (feedback !== undefined) order.feedback = feedback;
  await order.save();

  await redis.delete(`order:${orderId}`);
  await redis.deleteByPattern(`orders:user:${order.user}*`);
  await redis.deleteByPattern('orders*');
  await redis.delete('dashboard:stats');

  res.status(status.OK).json(new ApiResponse(status.OK, 'Custom order updated successfully', order));
  return;
});

export const confirmOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { id: orderId } = req.params;
  const { shippingAddressId } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (shippingAddressId) {
      if (!mongoose.Types.ObjectId.isValid(shippingAddressId)) {
        throw new ApiError(status.BAD_REQUEST, 'Invalid address ID');
      }
      const shippingAddress = await Address.findOne({ _id: shippingAddressId, user: userId, isDeleted: false }).session(session);
      if (!shippingAddress) {
        throw new ApiError(status.NOT_FOUND, 'Shipping address not found or you are not authorized to use it');
      }
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new ApiError(status.BAD_REQUEST, 'Invalid order ID');
    }
    const order = await Order.findOne({ _id: orderId, user: userId }).session(session);
    if (!order) {
      throw new ApiError(status.NOT_FOUND, 'order not found or you are not authorized to confirm it');
    }

    if (order.isCustomOrder && !shippingAddressId) {
      throw new ApiError(status.BAD_REQUEST, 'Shipping address is required for custom orders');
    }

    if (order.status !== OrderStatus.Approved) {
      throw new ApiError(status.BAD_REQUEST, 'You can only confirm approved orders');
    }

    const wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet || wallet.balance < order.totalAmount) {
      throw new ApiError(status.BAD_REQUEST, 'Insufficient wallet funds');
    }

    wallet.balance -= order.totalAmount;
    wallet.transactions.push({
      amount: -order.totalAmount,
      description: `Payment for order #${order._id}`,
      createdAt: new Date(),
    });
    await wallet.save({ session });

    order.status = OrderStatus.Confirmed;
    order.shippingAddress = shippingAddressId as Types.ObjectId;
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
  console.log('Fetching my orders...');
  const userId = req.user?._id;

  const cacheKey = generateCacheKey(`orders:user:${userId}`, req.query);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Your orders retrieved successfully", cached));
  }
  console.log('No cache found, querying database...');
  const {
    search,
    status: statusQuery,
    time,
    populate = "false",
    page = 1,
    limit = 10,
  } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  const now = new Date();
  const currentYear = now.getFullYear();
  const timeConditions: any[] = [];

  if (time) {
    const filters = (time as string).split(",");

    if (filters.includes("Last 30 days")) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      timeConditions.push({ createdAt: { $gte: d } });
    }

    if (filters.includes(currentYear.toString())) {
      timeConditions.push({
        createdAt: {
          $gte: new Date(currentYear, 0, 1),
          $lt: new Date(currentYear + 1, 0, 1),
        },
      });
    }

    if (filters.includes((currentYear - 1).toString())) {
      timeConditions.push({
        createdAt: {
          $gte: new Date(currentYear - 1, 0, 1),
          $lt: new Date(currentYear, 0, 1),
        },
      });
    }

    if (filters.includes("Older")) {
      timeConditions.push({
        createdAt: { $lt: new Date(currentYear - 1, 0, 1) },
      });
    }
  }

  let productIds: any[] = [];

  const pipeline: any[] = [];
  if (search) {
    const searchRegex = new RegExp(search as string, 'i');

    const productSearchResults = await Product.find(
      {
        $or: [
          { name: { $regex: searchRegex } },
          { slug: { $regex: searchRegex } },
          { tags: { $regex: searchRegex } }
        ]
      },
      { _id: 1 }
    );

    productIds = productSearchResults.map((p) => p._id);

    pipeline.push({ $match: { "items.product": { $in: productIds } } });
  }

  pipeline.push({ $match: { user: userId } });

  if (statusQuery) {
    pipeline.push({ $match: { status: statusQuery } });
  }

  if (timeConditions.length > 0) {
    pipeline.push({ $match: { $or: timeConditions } });
  }

  if (populate === "true") {
    pipeline.push({
      $lookup: {
        from: "products",
        localField: "items.product",
        foreignField: "_id",
        as: "productDocs",
      },
    });

    pipeline.push({
      $lookup: {
        from: "addresses",
        localField: "shippingAddress",
        foreignField: "_id",
        as: "shippingAddressDoc",
      },
    });

    pipeline.push({
      $addFields: {
        shippingAddress: { $arrayElemAt: ["$shippingAddressDoc", 0] },
        items: {
          $map: {
            input: "$items",
            as: "i",
            in: {
              $mergeObjects: [
                "$$i",
                {
                  product: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$productDocs",
                          as: "p",
                          cond: { $eq: ["$$p._id", "$$i.product"] },
                        },
                      },
                      0,
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    });

    pipeline.push({ $project: { productDocs: 0, shippingAddressDoc: 0 } });
  }

  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  const countPipeline = [
    ...pipeline.filter((p) => !("$skip" in p) && !("$limit" in p) && !("$sort" in p)),
    { $count: "total" },
  ];

  const [orders, totalAgg] = await Promise.all([
    Order.aggregate(pipeline),
    Order.aggregate(countPipeline),
  ]);

  const total = totalAgg?.[0]?.total || 0;

  const result = {
    orders,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / Number(limit)),
  };

  await redis.set(cacheKey, result, 600);

  return res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Your orders retrieved successfully", result));
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
        select: 'name email',
        populate: {
          path: 'wallet',
          select: 'balance'
        }
      },
      {
        path: 'items.product',
        select: 'name originalPrice thumbnail',
        populate: [
          {
            path: 'category',
            select: 'slug title path'
          },
          {
            path: 'brand',
            select: 'name slug'
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
  const cacheKey = generateCacheKey("orders", req.query);
  const cached = await redis.get(cacheKey);

  if (cached)
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "All orders retrieved successfully", cached));

  const { page = 1, limit = 10, status: orderStatus, user, isCustomOrder } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (orderStatus) filter.status = orderStatus;
  if (isCustomOrder !== undefined) filter.isCustomOrder = isCustomOrder === "true";

  if (user) {
    if (mongoose.Types.ObjectId.isValid(user as string)) {
      filter.user = new mongoose.Types.ObjectId(user as string);
    } else {
      const users = await User.aggregate([
        {
          $search: {
            index: "user_search",
            autocomplete: {
              query: user,
              path: ["name", "email", "phone"],
              fuzzy: { maxEdits: 1 }
            }
          }
        },
        { $project: { _id: 1 } }
      ]);

      const ids = users.map((u) => u._id);
      filter.user = { $in: ids };
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
    $project: { items: 0 }
  });

  const orders = await Order.aggregate(pipeline);
  const total = await Order.countDocuments(filter);
  const totalPages = Math.ceil(total / Number(limit));

  const result = {
    orders,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, 600);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "All orders retrieved successfully", result));
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
  if (oldStatus === OrderStatus.Received) {
    if (![OrderStatus.Approved, OrderStatus.Cancelled, OrderStatus.Confirmed].includes(newStatus)) {
      throw new ApiError(status.BAD_REQUEST, 'You can only approve, cancel, or confirm for a received order');
    }
    if ((newStatus === OrderStatus.Approved || newStatus === OrderStatus.Confirmed) && (order.items.length === 0 || !order.shippingAddress)) {
      throw new ApiError(status.BAD_REQUEST, 'You cannot approve or confirm an order with no items or without a shipping address');
    }
    if (newStatus === OrderStatus.Confirmed) {
      const wallet = await Wallet.findOne({ user: order.user });
      if (!wallet) throw new ApiError(status.NOT_FOUND, 'Wallet not found');

      wallet.balance -= order.totalAmount;
      wallet.transactions.push({
        amount: -order.totalAmount,
        description: `Payment for order #${order.id}`,
        createdAt: new Date()
      });
      await wallet.save();
    }
    order.status = newStatus;
  }
  else if (oldStatus === OrderStatus.Approved) {
    if (![OrderStatus.Cancelled, OrderStatus.Confirmed].includes(newStatus)) {
      throw new ApiError(status.BAD_REQUEST, 'You can only cancel or confirm an approved order');
    }

    if (newStatus === OrderStatus.Confirmed) {
      const wallet = await Wallet.findOne({ user: order.user });
      if (!wallet) throw new ApiError(status.NOT_FOUND, 'Wallet not found');

      wallet.balance -= order.totalAmount;
      wallet.transactions.push({
        amount: -order.totalAmount,
        description: `Payment for order #${order.id}`,
        createdAt: new Date()
      });
      await wallet.save();
    }

    order.status = newStatus;
  }
  else if (oldStatus === OrderStatus.Confirmed) {
    if (![OrderStatus.Shipped, OrderStatus.Cancelled].includes(newStatus)) {
      throw new ApiError(status.BAD_REQUEST, 'You can only ship or cancel a confirmed order');
    }
    order.status = newStatus;
  }
  else if (oldStatus === OrderStatus.Shipped) {
    if (newStatus !== OrderStatus.OutForDelivery) {
      throw new ApiError(status.BAD_REQUEST, 'A shipped order can only be marked as out for delivery');
    }

    order.status = newStatus;
  }
  else if (oldStatus === OrderStatus.OutForDelivery) {
    if (newStatus !== OrderStatus.Delivered) {
      throw new ApiError(status.BAD_REQUEST, 'An order out for delivery can only be marked as delivered');
    }

    order.status = newStatus;

    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product,
        {
          $inc: {
            salesCount: 1,
            totalSold: item.quantity,
          },
        }
      );
    }

    await redis.deleteByPattern('products*');
  }
  else if (oldStatus === OrderStatus.Delivered) {
    throw new ApiError(status.BAD_REQUEST, 'Order is already completed, cannot do anything anymore');
  }
  else if (oldStatus === OrderStatus.Cancelled) {
    if (newStatus !== OrderStatus.Refunded) {
      throw new ApiError(status.BAD_REQUEST, 'You can only refund a cancelled order');
    }

    order.status = newStatus;

    const wallet = await Wallet.findOne({ user: order.user });
    if (!wallet) throw new ApiError(status.NOT_FOUND, 'Wallet not found');

    wallet.balance += order.totalAmount;
    wallet.transactions.push({
      amount: order.totalAmount,
      description: `Refund for order ${order.id}`,
      createdAt: new Date()
    });

    await wallet.save();
  }
  else if (oldStatus === OrderStatus.Refunded) {
    throw new ApiError(status.BAD_REQUEST, 'Order is already refunded, cannot do anything anymore');
  }

  order.history.push({
    status: newStatus,
    timestamp: new Date()
  });

  await order.save();

  await redis.delete('dashboard:stats');
  await redis.deleteByPattern(`orders:user:${order.user}*`);
  await redis.deleteByPattern("orders*");
  await redis.delete(`order:${orderId}`);

  return res.status(status.OK).json(
    new ApiResponse(status.OK, 'Order status updated successfully', order)
  );
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
  if (![OrderStatus.Received, OrderStatus.Approved, OrderStatus.Confirmed].includes(order.status)) {
    throw new ApiError(status.BAD_REQUEST, 'only order with status Received, Approved or Confirmed can be cancelled');
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