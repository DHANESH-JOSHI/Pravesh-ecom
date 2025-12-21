"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelOrder = exports.updateOrderStatus = exports.getAllOrders = exports.getOrderById = exports.getMyOrders = exports.confirmOrder = exports.updateOrder = exports.createCustomOrder = exports.createOrder = void 0;
const utils_1 = require("../../utils");
const cacheTTL_1 = require("../../utils/cacheTTL");
const interface_1 = require("../../interface");
const order_model_1 = require("./order.model");
const cart_model_1 = require("../cart/cart.model");
const wallet_model_1 = require("../wallet/wallet.model");
const order_interface_1 = require("./order.interface");
const order_validation_1 = require("./order.validation");
const mongoose_1 = __importDefault(require("mongoose"));
const address_model_1 = require("../address/address.model");
const http_status_1 = __importDefault(require("http-status"));
const product_model_1 = require("../product/product.model");
const redis_1 = require("../../config/redis");
const redisKeys_1 = require("../../utils/redisKeys");
const redisKeys_2 = require("../../utils/redisKeys");
const user_model_1 = require("../user/user.model");
// import { StockStatus } from '../product/product.interface';
const ApiError = (0, interface_1.getApiErrorClass)("ORDER");
const ApiResponse = (0, interface_1.getApiResponseClass)("ORDER");
exports.createOrder = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { shippingAddressId } = order_validation_1.checkoutFromCartValidation.parse(req.body);
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const cart = await cart_model_1.Cart.findOne({ user: userId }).session(session);
        if (!cart || cart.items.length === 0) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'Your cart is empty');
        }
        const orderItems = [];
        let totalAmount = 0;
        for (const item of cart.items) {
            const product = await product_model_1.Product.findById(item.product).session(session);
            if (!product || product.isDeleted) {
                throw new ApiError(http_status_1.default.BAD_REQUEST, `Product with ID ${item.product} is not available.`);
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
            await product_model_1.Product.findByIdAndUpdate(item.product, {
                $inc: { stock: -item.quantity }
            }, { session });
        }
        const order = (await order_model_1.Order.create([{
                user: userId,
                items: orderItems,
                totalAmount,
                shippingAddress: shippingAddressId,
                status: order_interface_1.OrderStatus.Received,
            }], { session }))[0];
        cart.items = [];
        await cart.save({ session });
        await session.commitTransaction();
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_BY_USER(String(userId)));
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_ALL());
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.CART_BY_USER_ANY(String(userId)));
        await redis_1.redis.delete(redisKeys_1.RedisKeys.CART_SUMMARY_BY_USER(String(userId)));
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.PRODUCTS_ALL());
        res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, 'Order placed successfully', order));
        return;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
exports.createCustomOrder = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    if (!req.file) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'An image is required for a custom order');
    }
    const customOrderImage = req.file.path;
    const order = await order_model_1.Order.create({
        user: userId,
        items: [],
        totalAmount: 0,
        status: order_interface_1.OrderStatus.Received,
        isCustomOrder: true,
        image: customOrderImage,
    });
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_BY_USER(String(userId)));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_ALL());
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, 'Custom order request submitted successfully. An admin will review it shortly.', order));
    return;
});
exports.updateOrder = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id: orderId } = req.params;
    const { items, feedback } = order_validation_1.adminUpdateOrderValidation.parse(req.body);
    const order = await order_model_1.Order.findById(orderId);
    if (!order) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'order not found');
    }
    let totalAmount = order.totalAmount;
    if (items && items.length > 0) {
        for (const item of items) {
            if (!mongoose_1.default.Types.ObjectId.isValid(item.product)) {
                throw new ApiError(http_status_1.default.BAD_REQUEST, `Invalid product ID: ${item.product}`);
            }
            if (item.quantity <= 0) {
                throw new ApiError(http_status_1.default.BAD_REQUEST, 'Quantity must be a positive number');
            }
            const product = await product_model_1.Product.findById(item.product).select('originalPrice');
            if (!product) {
                throw new ApiError(http_status_1.default.NOT_FOUND, `Product not found: ${item.product}`);
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
    if (feedback !== undefined)
        order.feedback = feedback;
    await order.save();
    await redis_1.redis.delete(redisKeys_1.RedisKeys.ORDER_BY_ID(orderId));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_BY_USER(String(order.user)));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_ALL());
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Custom order updated successfully', order));
    return;
});
exports.confirmOrder = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { id: orderId } = req.params;
    const { shippingAddressId } = req.body;
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        if (shippingAddressId) {
            if (!mongoose_1.default.Types.ObjectId.isValid(shippingAddressId)) {
                throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid address ID');
            }
            const shippingAddress = await address_model_1.Address.findOne({ _id: shippingAddressId, user: userId, isDeleted: false }).session(session);
            if (!shippingAddress) {
                throw new ApiError(http_status_1.default.NOT_FOUND, 'Shipping address not found or you are not authorized to use it');
            }
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(orderId)) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid order ID');
        }
        const order = await order_model_1.Order.findOne({ _id: orderId, user: userId }).session(session);
        if (!order) {
            throw new ApiError(http_status_1.default.NOT_FOUND, 'order not found or you are not authorized to confirm it');
        }
        if (order.isCustomOrder && !shippingAddressId) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'Shipping address is required for custom orders');
        }
        if (order.status !== order_interface_1.OrderStatus.Approved) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'You can only confirm approved orders');
        }
        const wallet = await wallet_model_1.Wallet.findOne({ user: userId }).session(session);
        if (!wallet || wallet.balance < order.totalAmount) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'Insufficient wallet funds');
        }
        wallet.balance -= order.totalAmount;
        wallet.transactions.push({
            amount: -order.totalAmount,
            description: `Payment for order #${order._id}`,
            createdAt: new Date(),
        });
        await wallet.save({ session });
        order.status = order_interface_1.OrderStatus.Confirmed;
        order.shippingAddress = shippingAddressId;
        await order.save({ session });
        await session.commitTransaction();
        await redis_1.redis.delete(redisKeys_1.RedisKeys.ORDER_BY_ID(orderId));
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_BY_USER(String(userId)));
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_ALL());
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.WALLET_BY_USER_ANY(String(userId)));
        await redis_1.redis.delete(redisKeys_1.RedisKeys.WALLET_BALANCE(String(userId)));
        await redis_1.redis.delete(redisKeys_1.RedisKeys.WALLET_TRANSACTIONS(String(userId)));
        res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Custom order confirmed and paid successfully', order));
        return;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
});
exports.getMyOrders = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const cacheKey = redisKeys_1.RedisKeys.ORDERS_BY_USER(String(userId), req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached) {
        return res
            .status(http_status_1.default.OK)
            .json(new ApiResponse(http_status_1.default.OK, "Your orders retrieved successfully", cached));
    }
    const { search, status: statusQuery, time, populate = "false", page = 1, limit = 10, } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();
    const currentYear = now.getFullYear();
    const timeConditions = [];
    if (time) {
        const filters = time.split(",");
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
    let productIds = [];
    const pipeline = [];
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        const productSearchResults = await product_model_1.Product.find({
            $or: [
                { name: { $regex: searchRegex } },
                { slug: { $regex: searchRegex } },
                { tags: { $regex: searchRegex } }
            ]
        }, { _id: 1 });
        productIds = productSearchResults.map((p) => p._id);
        pipeline.push({ $match: { "items.product": { $in: productIds } } });
    }
    pipeline.push({ $match: { user: new mongoose_1.default.Types.ObjectId(userId) } });
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
        order_model_1.Order.aggregate(pipeline),
        order_model_1.Order.aggregate(countPipeline),
    ]);
    const total = totalAgg?.[0]?.total || 0;
    const result = {
        orders,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
    };
    await redis_1.redis.set(cacheKey, result, cacheTTL_1.CacheTTL.SHORT);
    return res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "Your orders retrieved successfully", result));
});
exports.getOrderById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id: orderId } = req.params;
    const cacheKey = redisKeys_1.RedisKeys.ORDER_BY_ID(orderId);
    const cachedOrder = await redis_1.redis.get(cacheKey);
    if (cachedOrder) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Order retrieved successfully', cachedOrder));
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(orderId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid order ID');
    }
    const order = await order_model_1.Order.findById(orderId).populate([
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
            path: 'items.product',
            select: 'name originalPrice thumbnail',
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
    ]);
    if (!order) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Order not found');
    }
    const orderObj = order?.toObject ? order.toObject() : order;
    await redis_1.redis.set(cacheKey, orderObj, cacheTTL_1.CacheTTL.SHORT);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Order retrieved successfully', order));
    return;
});
exports.getAllOrders = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = redisKeys_1.RedisKeys.ORDERS_LIST(req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res
            .status(http_status_1.default.OK)
            .json(new ApiResponse(http_status_1.default.OK, "All orders retrieved successfully", cached));
    const { page = 1, limit = 10, status: orderStatus, user, isCustomOrder } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};
    if (orderStatus)
        filter.status = orderStatus;
    if (isCustomOrder !== undefined)
        filter.isCustomOrder = isCustomOrder === "true";
    if (user) {
        if (mongoose_1.default.Types.ObjectId.isValid(user)) {
            filter.user = new mongoose_1.default.Types.ObjectId(user);
        }
        else {
            const userRegex = new RegExp(user, 'i');
            const users = await user_model_1.User.find({
                $or: [
                    { name: { $regex: userRegex } },
                    { email: { $regex: userRegex } },
                    { phone: { $regex: userRegex } }
                ],
                isDeleted: false
            }, { _id: 1 });
            const userIds = users.map((u) => u._id);
            filter.user = userIds.length > 0 ? { $in: userIds } : [];
        }
    }
    const pipeline = [];
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
    const orders = await order_model_1.Order.aggregate(pipeline);
    const total = await order_model_1.Order.countDocuments(filter);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        orders,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, cacheTTL_1.CacheTTL.SHORT);
    res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "All orders retrieved successfully", result));
});
exports.updateOrderStatus = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id: orderId } = req.params;
    const { status: newStatus } = req.body;
    if (!Object.values(order_interface_1.OrderStatus).includes(newStatus)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid order status');
    }
    const order = await order_model_1.Order.findById(orderId);
    if (!order) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Order not found');
    }
    const oldStatus = order.status;
    if (oldStatus === order_interface_1.OrderStatus.Received) {
        if (![order_interface_1.OrderStatus.Approved, order_interface_1.OrderStatus.Cancelled, order_interface_1.OrderStatus.Confirmed].includes(newStatus)) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'You can only approve, cancel, or confirm for a received order');
        }
        if ((newStatus === order_interface_1.OrderStatus.Approved || newStatus === order_interface_1.OrderStatus.Confirmed) && (order.items.length === 0 || !order.shippingAddress)) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'You cannot approve or confirm an order with no items or without a shipping address');
        }
        if (newStatus === order_interface_1.OrderStatus.Confirmed) {
            const wallet = await wallet_model_1.Wallet.findOne({ user: order.user });
            if (!wallet)
                throw new ApiError(http_status_1.default.NOT_FOUND, 'Wallet not found');
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
    else if (oldStatus === order_interface_1.OrderStatus.Approved) {
        if (![order_interface_1.OrderStatus.Cancelled, order_interface_1.OrderStatus.Confirmed].includes(newStatus)) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'You can only cancel or confirm an approved order');
        }
        if (newStatus === order_interface_1.OrderStatus.Confirmed) {
            const wallet = await wallet_model_1.Wallet.findOne({ user: order.user });
            if (!wallet)
                throw new ApiError(http_status_1.default.NOT_FOUND, 'Wallet not found');
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
    else if (oldStatus === order_interface_1.OrderStatus.Confirmed) {
        if (![order_interface_1.OrderStatus.Shipped, order_interface_1.OrderStatus.Cancelled].includes(newStatus)) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'You can only ship or cancel a confirmed order');
        }
        order.status = newStatus;
    }
    else if (oldStatus === order_interface_1.OrderStatus.Shipped) {
        if (newStatus !== order_interface_1.OrderStatus.OutForDelivery) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'A shipped order can only be marked as out for delivery');
        }
        order.status = newStatus;
    }
    else if (oldStatus === order_interface_1.OrderStatus.OutForDelivery) {
        if (newStatus !== order_interface_1.OrderStatus.Delivered) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'An order out for delivery can only be marked as delivered');
        }
        order.status = newStatus;
        for (const item of order.items) {
            await product_model_1.Product.findByIdAndUpdate(item.product, {
                $inc: {
                    salesCount: 1,
                    totalSold: item.quantity,
                },
            });
        }
    }
    else if (oldStatus === order_interface_1.OrderStatus.Delivered) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Order is already completed, cannot do anything anymore');
    }
    else if (oldStatus === order_interface_1.OrderStatus.Cancelled) {
        if (newStatus !== order_interface_1.OrderStatus.Refunded) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, 'You can only refund a cancelled order');
        }
        order.status = newStatus;
        const wallet = await wallet_model_1.Wallet.findOne({ user: order.user });
        if (!wallet)
            throw new ApiError(http_status_1.default.NOT_FOUND, 'Wallet not found');
        wallet.balance += order.totalAmount;
        wallet.transactions.push({
            amount: order.totalAmount,
            description: `Refund for order ${order.id}`,
            createdAt: new Date()
        });
        await wallet.save();
    }
    else if (oldStatus === order_interface_1.OrderStatus.Refunded) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Order is already refunded, cannot do anything anymore');
    }
    order.history.push({
        status: newStatus,
        timestamp: new Date()
    });
    await order.save();
    await redis_1.redis.delete(redisKeys_1.RedisKeys.ORDER_BY_ID(orderId));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_BY_USER(String(order.user)));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_ALL());
    const productsTouched = oldStatus === order_interface_1.OrderStatus.OutForDelivery && newStatus === order_interface_1.OrderStatus.Delivered;
    if (productsTouched) {
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.PRODUCTS_ALL());
    }
    const walletTouched = (oldStatus === order_interface_1.OrderStatus.Received && newStatus === order_interface_1.OrderStatus.Confirmed) ||
        (oldStatus === order_interface_1.OrderStatus.Approved && newStatus === order_interface_1.OrderStatus.Confirmed) ||
        (oldStatus === order_interface_1.OrderStatus.Cancelled && newStatus === order_interface_1.OrderStatus.Refunded);
    if (walletTouched) {
        await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.WALLET_BY_USER_ANY(String(order.user)));
        await redis_1.redis.delete(redisKeys_1.RedisKeys.WALLET_BALANCE(String(order.user)));
        await redis_1.redis.delete(redisKeys_1.RedisKeys.WALLET_TRANSACTIONS(String(order.user)));
    }
    return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Order status updated successfully', order));
});
exports.cancelOrder = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { id: orderId } = req.params;
    const order = await order_model_1.Order.findById(orderId);
    if (!order) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Order not found');
    }
    if (String(order.user) !== String(userId)) {
        throw new ApiError(http_status_1.default.FORBIDDEN, 'You are not authorized to cancel this order');
    }
    if (![order_interface_1.OrderStatus.Received, order_interface_1.OrderStatus.Approved, order_interface_1.OrderStatus.Confirmed].includes(order.status)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'only order with status Received, Approved or Confirmed can be cancelled');
    }
    order.status = order_interface_1.OrderStatus.Cancelled;
    await order.save();
    await redis_1.redis.delete(redisKeys_1.RedisKeys.ORDER_BY_ID(orderId));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_BY_USER(String(userId)));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.ORDERS_ALL());
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Order canceled successfully', order));
    return;
});
//# sourceMappingURL=order.controller.js.map