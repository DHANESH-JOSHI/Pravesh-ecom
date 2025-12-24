import { asyncHandler } from "@/utils";
import { CacheTTL } from "@/utils/cacheTTL";
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { Order } from './order.model';
import { Cart } from '../cart/cart.model';
// import { Wallet } from '../wallet/wallet.model'; // Commented out - wallet operations removed (price removed)
import { OrderStatus } from './order.interface';
import { checkoutFromCartValidation, adminUpdateOrderValidation } from './order.validation';
import mongoose, { Types } from 'mongoose';
import { Address } from '../address/address.model';
import status from 'http-status';
import { Product } from '../product/product.model';
import { redis } from "@/config/redis";
import { RedisKeys } from "@/utils/redisKeys";
import { RedisPatterns } from '@/utils/redisKeys';
import { User } from '../user/user.model';
import { logOrderChange } from '../order-log/order-log.service';
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
        unit: item.unit,
        variantSelections: item.variantSelections || {},
      });
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

    // Stock decrement removed - stock field no longer exists
    // for (const item of cart.items) {
    //   await Product.findByIdAndUpdate(item.product, {
    //     $inc: { stock: -item.quantity }
    //   }, { session });
    // }
    const order = (await Order.create([{
      user: userId,
      items: orderItems,
      shippingAddress: shippingAddressId,
      status: OrderStatus.Received,
      history: [{
        status: OrderStatus.Received,
        timestamp: new Date(),
        updatedBy: undefined, // System created
      }],
    }], { session }))[0];

    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();

    // Invalidate orders by this user (new order added, affects user orders list)
    await redis.deleteByPattern(RedisPatterns.ORDERS_BY_USER(String(userId)));
    // Invalidate all order lists (new order added to lists)
    await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
    // Invalidate this user's cart (cart was cleared after order creation)
    await redis.deleteByPattern(RedisPatterns.CART_BY_USER_ANY(String(userId)));
    // Invalidate this user's cart summary (cart was cleared)
    await redis.delete(RedisKeys.CART_SUMMARY_BY_USER(String(userId)));
    // Invalidate all product lists (order creation might affect product salesCount/totalSold)
    await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
    // Invalidate user cache (user might have order count displayed)
    await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));
    // Invalidate dashboard stats (order count and stats changed)
    await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());

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
    status: OrderStatus.Received,
    isCustomOrder: true,
    image: customOrderImage,
  });

  // Invalidate orders by this user (custom order created, affects user orders list)
  await redis.deleteByPattern(RedisPatterns.ORDERS_BY_USER(String(userId)));
  // Invalidate all order lists (custom order added to lists)
  await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
  // Invalidate user cache (user might have order count displayed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));
  // Invalidate dashboard stats (order count changed)
  await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());

  res.status(status.CREATED).json(new ApiResponse(status.CREATED, 'Custom order request submitted successfully. An admin will review it shortly.', order));
  return;
});

export const updateOrder = asyncHandler(async (req, res) => {
  const { id: orderId } = req.params;
  const { items, feedback } = adminUpdateOrderValidation.parse(req.body);
  const adminId = req.user?._id;
  const userRole = req.user?.role;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(status.NOT_FOUND, 'order not found');
  }

  // If order is already delivered and items are being updated, adjust salesCount and totalSold
  const wasDelivered = order.status === OrderStatus.Delivered;
  const oldItems = wasDelivered ? [...order.items] : [];
  const oldFeedback = order.feedback;

  if (items && items.length > 0) {
    const orderItems = [];
    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.product)) {
        throw new ApiError(status.BAD_REQUEST, `Invalid product ID: ${item.product}`);
      }
      if (item.quantity <= 0) {
        throw new ApiError(status.BAD_REQUEST, 'Quantity must be a positive number');
      }
      const product = await Product.findById(item.product);
      if (!product) {
        throw new ApiError(status.NOT_FOUND, `Product not found: ${item.product}`);
      }
      orderItems.push({
        product: item.product,
        quantity: item.quantity,
        unit: item.unit,
        variantSelections: (item as any).variantSelections || {},
      });
    }
    
    // Log items change only for staff users (not super admin)
    if (adminId && userRole === 'staff') {
      await logOrderChange({
        orderId: String(order._id),
        adminId: String(adminId),
        action: 'items_updated',
        field: 'items',
        oldValue: oldItems,
        newValue: orderItems,
        description: `Order items updated. Old: ${oldItems.length} items, New: ${orderItems.length} items`,
      });
    }
    
    order.items = orderItems;
  }
  
  if (feedback !== undefined && feedback !== oldFeedback) {
    // Log feedback change only for staff users (not super admin)
    if (adminId && userRole === 'staff') {
      await logOrderChange({
        orderId: String(order._id),
        adminId: String(adminId),
        action: 'feedback_updated',
        field: 'feedback',
        oldValue: oldFeedback,
        newValue: feedback,
        description: `Order feedback updated`,
      });
    }
    
    order.feedback = feedback;
  }
  
  await order.save();

  // If order was delivered and items changed, adjust salesCount and totalSold
  if (wasDelivered && items && items.length > 0) {
    const productIds = new Set<string>();
    
    // Decrement old items
    for (const oldItem of oldItems) {
      const productId = String(oldItem.product);
      productIds.add(productId);
      await Product.findByIdAndUpdate(
        oldItem.product,
        {
          $inc: {
            salesCount: -1,
            totalSold: -oldItem.quantity,
          },
        }
      );
    }

    // Increment new items
    for (const newItem of order.items) {
      const productId = String(newItem.product);
      productIds.add(productId);
      await Product.findByIdAndUpdate(
        newItem.product,
        {
          $inc: {
            salesCount: 1,
            totalSold: newItem.quantity,
          },
        }
      );
    }

    // Invalidate product caches
    for (const productId of productIds) {
      await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(productId));
    }
    if (productIds.size > 0) {
      await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
    }
  }

  // Invalidate this order's cache (order feedback updated)
  await redis.delete(RedisKeys.ORDER_BY_ID(orderId));
  // Invalidate orders by this user (order feedback updated, affects user orders list)
  await redis.deleteByPattern(RedisPatterns.ORDERS_BY_USER(String(order.user)));
  // Invalidate all order lists (order feedback updated in lists)
  await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
  // Invalidate user cache (user might have order count displayed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(order.user)));
  // Invalidate dashboard stats (order data might affect stats)
  await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());

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

    // Wallet operations commented out - totalAmount is now 0 (price removed)
    // const wallet = await Wallet.findOne({ user: userId }).session(session);
    // if (!wallet || wallet.balance < order.totalAmount) {
    //   throw new ApiError(status.BAD_REQUEST, 'Insufficient wallet funds');
    // }

    // wallet.balance -= order.totalAmount;
    // wallet.transactions.push({
    //   amount: -order.totalAmount,
    //   description: `Payment for order #${order._id}`,
    //   createdAt: new Date(),
    // });
    // await wallet.save({ session });

    order.status = OrderStatus.Confirmed;
    order.shippingAddress = shippingAddressId as Types.ObjectId;
    await order.save({ session });

    await session.commitTransaction();

    // Invalidate this order's cache (order cancelled)
    await redis.delete(RedisKeys.ORDER_BY_ID(orderId));
    // Invalidate orders by this user (order cancelled, affects user orders list)
    await redis.deleteByPattern(RedisPatterns.ORDERS_BY_USER(String(userId)));
    // Invalidate all order lists (order cancelled, removed from lists)
    await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
    // Invalidate user's wallet cache (wallet refunded, balance changed)
    await redis.deleteByPattern(RedisPatterns.WALLET_BY_USER_ANY(String(userId)));
    // Invalidate wallet balance (balance changed due to refund)
    await redis.delete(RedisKeys.WALLET_BALANCE(String(userId)));
    // Invalidate wallet transactions (new refund transaction added)
    await redis.delete(RedisKeys.WALLET_TRANSACTIONS(String(userId)));
    // Invalidate user cache (user might have order count or wallet balance displayed)
    await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));
    // Invalidate dashboard stats (order status stats changed)
    await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());

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

  const cacheKey = RedisKeys.ORDERS_BY_USER(String(userId), req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Your orders retrieved successfully", cached));
  }
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

  pipeline.push({ $match: { user: new mongoose.Types.ObjectId(userId as string) } });

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

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  return res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Your orders retrieved successfully", result));
});


export const getOrderById = asyncHandler(async (req, res) => {
  const { id: orderId } = req.params;
  const adminId = req.user?._id as string | Types.ObjectId | undefined;
  const userRole = req.user?.role as string | undefined;
  
  const cacheKey = RedisKeys.ORDER_BY_ID(orderId);
  const cachedOrder = await redis.get(cacheKey);

  if (cachedOrder) {
    // Log view only for staff users (not super admin)
    if (adminId && userRole === 'staff') {
      await logOrderChange({
        orderId: String(orderId),
        adminId: String(adminId),
        action: 'view',
        description: `Order viewed by ${userRole}`,
        metadata: { cached: true }
      });
    }
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
        match: { isDeleted: false },
        populate: {
          path: 'wallet',
          select: 'balance'
        }
      },
      {
        path: 'history.updatedBy',
        select: 'name email role'
      },
      {
        path: 'items.product',
        select: 'name thumbnail',
        populate: [
          {
            path: 'category',
            select: 'slug title path',
            match: { isDeleted: false }
          },
          {
            path: 'brand',
            select: 'name slug',
            match: { isDeleted: false }
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

  // Log view only for staff users (not super admin)
  if (adminId && userRole === 'staff') {
    await logOrderChange({
      orderId: String(orderId),
      adminId: String(adminId),
      action: 'view',
      description: `Order viewed by ${userRole}`,
      metadata: { cached: false }
    });
  }

  const orderObj = (order as any)?.toObject ? (order as any).toObject() : order;
  await redis.set(cacheKey, orderObj, CacheTTL.SHORT);

  res.status(status.OK).json(new ApiResponse(status.OK, 'Order retrieved successfully', order));
  return;
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const adminId = req.user?._id as string | Types.ObjectId | undefined;
  const userRole = req.user?.role as string | undefined;
  
  const cacheKey = RedisKeys.ORDERS_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);

  if (cached) {
    // Log view only for staff users (not super admin)
    if (adminId && userRole === 'staff') {
      await logOrderChange({
        adminId: String(adminId),
        action: 'view_list',
        description: `Orders list viewed by ${userRole}`,
        metadata: { 
          cached: true,
          query: req.query 
        }
      });
    }
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "All orders retrieved successfully", cached));
  }

  const { page = 1, limit = 10, status: orderStatus, user, isCustomOrder } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (orderStatus) filter.status = orderStatus;
  if (isCustomOrder !== undefined) filter.isCustomOrder = isCustomOrder === "true";

  if (user) {
    if (mongoose.Types.ObjectId.isValid(user as string)) {
      filter.user = new mongoose.Types.ObjectId(user as string);
    } else {
      const userRegex = new RegExp(user as string, 'i');

      const users = await User.find(
        {
          $or: [
            { name: { $regex: userRegex } },
            { email: { $regex: userRegex } },
            { phone: { $regex: userRegex } }
          ],
          isDeleted: false
        },
        { _id: 1 }
      );

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
        { $match: { isDeleted: false } },
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

  // Log view only for staff users (not super admin)
  if (adminId && userRole === 'staff') {
    await logOrderChange({
      adminId: String(adminId),
      action: 'view_list',
      description: `Orders list viewed by ${userRole}`,
      metadata: { 
        cached: false,
        query: req.query,
        total,
        page: Number(page),
        limit: Number(limit)
      }
    });
  }

  const result = {
    orders,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

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
      // Wallet operations commented out - totalAmount is now 0 (price removed)
      // const wallet = await Wallet.findOne({ user: order.user });
      // if (!wallet) throw new ApiError(status.NOT_FOUND, 'Wallet not found');

      // wallet.balance -= order.totalAmount;
      // wallet.transactions.push({
      //   amount: -order.totalAmount,
      //   description: `Payment for order #${order.id}`,
      //   createdAt: new Date()
      // });
      // await wallet.save();
    }
    order.status = newStatus;
  }
  else if (oldStatus === OrderStatus.Approved) {
    if (![OrderStatus.Cancelled, OrderStatus.Confirmed].includes(newStatus)) {
      throw new ApiError(status.BAD_REQUEST, 'You can only cancel or confirm an approved order');
    }

    if (newStatus === OrderStatus.Confirmed) {
      // Wallet operations commented out - totalAmount is now 0 (price removed)
      // const wallet = await Wallet.findOne({ user: order.user });
      // if (!wallet) throw new ApiError(status.NOT_FOUND, 'Wallet not found');

      // wallet.balance -= order.totalAmount;
      // wallet.transactions.push({
      //   amount: -order.totalAmount,
      //   description: `Payment for order #${order.id}`,
      //   createdAt: new Date()
      // });
      // await wallet.save();
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

    const productIds: string[] = [];
    for (const item of order.items) {
      productIds.push(String(item.product));
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
    // Invalidate specific product caches (product salesCount and totalSold changed)
    for (const productId of productIds) {
      await redis.deleteByPattern(RedisPatterns.PRODUCT_ANY(productId));
    }
    // Also invalidate category and brand caches that have these products (productCount might change)
    const products = await Product.find({ _id: { $in: productIds }, isDeleted: false }).select('category brand');
    const categoryIds = new Set<string>();
    const brandIds = new Set<string>();
    for (const product of products) {
      if (product.category) categoryIds.add(String(product.category));
      if (product.brand) brandIds.add(String(product.brand));
    }
    // Invalidate category caches (category productCount might have changed)
    for (const categoryId of categoryIds) {
      await redis.deleteByPattern(RedisPatterns.CATEGORY_ANY(categoryId));
    }
    // Invalidate brand caches (brand productCount might have changed)
    for (const brandId of brandIds) {
      await redis.deleteByPattern(RedisPatterns.BRAND_ANY(brandId));
    }
    if (productIds.length > 0) {
      // Invalidate all product lists (product salesCount/totalSold changed in lists)
      await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
    }
    if (categoryIds.size > 0) {
      // Invalidate all category lists (productCount might have changed in lists)
      await redis.deleteByPattern(RedisPatterns.CATEGORIES_ALL());
    }
    if (brandIds.size > 0) {
      // Invalidate all brand lists (productCount might have changed in lists)
      await redis.deleteByPattern(RedisPatterns.BRANDS_ALL());
    }
  }
  else if (oldStatus === OrderStatus.Delivered) {
    throw new ApiError(status.BAD_REQUEST, 'Order is already completed, cannot do anything anymore');
  }
  else if (oldStatus === OrderStatus.Cancelled) {
    if (newStatus !== OrderStatus.Refunded) {
      throw new ApiError(status.BAD_REQUEST, 'You can only refund a cancelled order');
    }

    order.status = newStatus;

    // Wallet refund operations commented out - totalAmount is now 0 (price removed)
    // const wallet = await Wallet.findOne({ user: order.user });
    // if (!wallet) throw new ApiError(status.NOT_FOUND, 'Wallet not found');

    // wallet.balance += order.totalAmount;
    // wallet.transactions.push({
    //   amount: order.totalAmount,
    //   description: `Refund for order ${order.id}`,
    //   createdAt: new Date()
    // });

    // await wallet.save();
  }
  else if (oldStatus === OrderStatus.Refunded) {
    throw new ApiError(status.BAD_REQUEST, 'Order is already refunded, cannot do anything anymore');
  }

  const loggedAdminId = req.user?._id;
  order.history.push({
    status: newStatus,
    timestamp: new Date(),
    updatedBy: loggedAdminId ? (loggedAdminId as Types.ObjectId) : undefined
  });

  await order.save();

  // Log status change only for staff users (not super admin)
  const loggedUserRole = req.user?.role;
  if (loggedAdminId && loggedUserRole === 'staff') {
    await logOrderChange({
      orderId: String(order._id),
      adminId: String(loggedAdminId),
      action: 'status_update',
      field: 'status',
      oldValue: oldStatus,
      newValue: newStatus,
      description: `Order status changed from ${oldStatus} to ${newStatus}`,
      metadata: {
        orderId: String(order._id),
        userId: String(order.user),
      },
    });
  }

  // Invalidate this order's cache (order status changed)
  await redis.delete(RedisKeys.ORDER_BY_ID(orderId));
  // Invalidate orders by this user (order status changed, affects user orders list)
  await redis.deleteByPattern(RedisPatterns.ORDERS_BY_USER(String(order.user)));
  // Invalidate all order lists (order status changed in lists)
  await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
  // Invalidate user cache (user might have order count displayed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(order.user)));
  // Invalidate dashboard stats (order status stats changed)
  await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());
  
  // If wallet was affected by status change, invalidate wallet caches
  const walletTouched = 
    (oldStatus === OrderStatus.Received && newStatus === OrderStatus.Confirmed) ||
    (oldStatus === OrderStatus.Approved && newStatus === OrderStatus.Confirmed) ||
    (oldStatus === OrderStatus.Cancelled && newStatus === OrderStatus.Refunded);
  if (walletTouched) {
    // Invalidate user's wallet cache (wallet balance changed)
    await redis.deleteByPattern(RedisPatterns.WALLET_BY_USER_ANY(String(order.user)));
    // Invalidate wallet balance (balance changed)
    await redis.delete(RedisKeys.WALLET_BALANCE(String(order.user)));
    // Invalidate wallet transactions (new transaction added)
    await redis.delete(RedisKeys.WALLET_TRANSACTIONS(String(order.user)));
  }

  return res.status(status.OK).json(
    new ApiResponse(status.OK, 'Order status updated successfully', order)
  );
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { id: orderId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(status.NOT_FOUND, 'Order not found');
  }
  if (String(order.user) !== String(userId)) {
    throw new ApiError(status.FORBIDDEN, 'You are not authorized to cancel this order');
  }
  if (![OrderStatus.Received, OrderStatus.Approved, OrderStatus.Confirmed].includes(order.status)) {
    throw new ApiError(status.BAD_REQUEST, 'only order with status Received, Approved or Confirmed can be cancelled');
  }
  order.status = OrderStatus.Cancelled;
  await order.save();

  // Invalidate this order's cache (order cancelled)
  await redis.delete(RedisKeys.ORDER_BY_ID(orderId));
  // Invalidate orders by this user (order cancelled, affects user orders list)
  await redis.deleteByPattern(RedisPatterns.ORDERS_BY_USER(String(userId)));
  // Invalidate all order lists (order cancelled, removed from lists)
  await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
  // Invalidate user cache (user might have order count displayed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));
  // Invalidate dashboard stats (order status stats changed)
  await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Order canceled successfully', order)
  );
  return;
});