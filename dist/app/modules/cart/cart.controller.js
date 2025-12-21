"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkoutCart = exports.getCartSummary = exports.clearCart = exports.removeFromCart = exports.updateCartItem = exports.addToCart = exports.getAllCarts = exports.getMyCart = exports.getCartById = void 0;
const cart_model_1 = require("./cart.model");
const mongoose_1 = __importStar(require("mongoose"));
const product_model_1 = require("../product/product.model");
const utils_1 = require("../../utils");
const cacheTTL_1 = require("../../utils/cacheTTL");
const redisKeys_1 = require("../../utils/redisKeys");
const interface_1 = require("../../interface");
const cart_validation_1 = require("./cart.validation");
const http_status_1 = __importDefault(require("http-status"));
const redis_1 = require("../../config/redis");
const user_model_1 = require("../user/user.model");
const invalidateCache_1 = require("../../utils/invalidateCache");
const ApiError = (0, interface_1.getApiErrorClass)("CART");
const ApiResponse = (0, interface_1.getApiResponseClass)("CART");
exports.getCartById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const cacheKey = redisKeys_1.RedisKeys.CART_BY_ID(id);
    const cachedCart = await redis_1.redis.get(cacheKey);
    if (cachedCart) {
        res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Cart retrieved successfully', cachedCart));
        return;
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid cart ID');
    }
    const cart = await cart_model_1.Cart.findById(id).populate([
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
            select: '_id name thumbnail originalPrice',
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
    ]).lean();
    if (!cart) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Cart not found');
    }
    const cartObj = cart?.toObject ? cart.toObject() : cart;
    await redis_1.redis.set(cacheKey, cartObj, cacheTTL_1.CacheTTL.MEDIUM);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Cart retrieved successfully', cartObj));
    return;
});
exports.getMyCart = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { populate = 'false' } = req.query;
    const cacheKey = redisKeys_1.RedisKeys.CART_BY_USER(userId, req.query);
    const cachedCart = await redis_1.redis.get(cacheKey);
    if (cachedCart) {
        res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Cart retrieved successfully', cachedCart));
        return;
    }
    let cart;
    if (populate === 'true') {
        cart = await cart_model_1.Cart.findOne({ user: userId }).populate({ path: 'items.product', match: { isDeleted: false } }).lean();
    }
    else {
        cart = await cart_model_1.Cart.findOne({ user: userId }).lean();
    }
    if (!cart) {
        cart = await cart_model_1.Cart.create({ user: userId, items: [] });
    }
    const cartObj = cart?.toObject ? cart.toObject() : cart;
    await redis_1.redis.set(cacheKey, cartObj, cacheTTL_1.CacheTTL.MEDIUM);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Cart retrieved successfully', cartObj));
    return;
});
exports.getAllCarts = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, user } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const cacheKey = redisKeys_1.RedisKeys.CARTS_LIST(req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res
            .status(http_status_1.default.OK)
            .json(new ApiResponse(http_status_1.default.OK, "Carts retrieved successfully", cached));
    const filter = {};
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
                    { phone: { $regex: userRegex } },
                ]
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
                { $project: { _id: 1, originalPrice: 1 } }
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
                        quantity: "$$item.quantity"
                    }
                }
            }
        }
    });
    pipeline.push({ $project: { productData: 0 } });
    const carts = await cart_model_1.Cart.aggregate(pipeline);
    const total = await cart_model_1.Cart.countDocuments(filter);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        carts,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, cacheTTL_1.CacheTTL.SHORT);
    res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "Carts retrieved successfully", result));
});
exports.addToCart = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { productId, quantity } = cart_validation_1.addToCartValidation.parse(req.body);
    if (!mongoose_1.default.Types.ObjectId.isValid(productId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid product ID');
    }
    const product = await product_model_1.Product.findOne({
        _id: productId,
        isDeleted: false,
    });
    if (!product) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found or unavailable');
    }
    // if (product.stockStatus === StockStatus.OutOfStock) {
    //   throw new ApiError(status.BAD_REQUEST, 'Product is out of stock');
    // }
    // if (product.stock < quantity) {
    //   throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock`);
    // }
    let cart = await cart_model_1.Cart.findOne({ user: userId });
    if (!cart) {
        cart = new cart_model_1.Cart({ user: userId, items: [] });
    }
    await cart.addItem(productId, quantity);
    const populatedCart = await cart_model_1.Cart.findOne({ user: userId }).populate({ path: 'items.product', select: 'name price thumbnail', match: { isDeleted: false } });
    await (0, invalidateCache_1.invalidateCartCaches)({
        cartId: String(cart._id),
        userId: String(userId),
    });
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Item added to cart successfully', populatedCart));
    return;
});
exports.updateCartItem = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { productId } = req.params;
    const { quantity } = cart_validation_1.updateCartItemValidation.parse(req.body);
    if (!mongoose_1.default.Types.ObjectId.isValid(productId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid product ID');
    }
    const cart = await cart_model_1.Cart.findOne({ user: userId });
    if (!cart) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Cart not found');
    }
    const product = await product_model_1.Product.findOne({
        _id: productId,
        isDeleted: false,
    });
    if (!product) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found or unavailable');
    }
    // if (product.stock < quantity) {
    //   throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock`);
    // }
    try {
        await cart.updateItem(new mongoose_1.Types.ObjectId(productId), quantity);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Item not found in cart') {
            throw new ApiError(http_status_1.default.NOT_FOUND, 'Item not found in cart');
        }
        throw error;
    }
    const updatedCart = await cart_model_1.Cart.findOne({ user: userId }).populate({ path: 'items.product', select: 'name price thumbnail', match: { isDeleted: false } });
    await (0, invalidateCache_1.invalidateCartCaches)({
        cartId: String(cart._id),
        userId: String(userId),
    });
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Cart item updated successfully', updatedCart));
    return;
});
exports.removeFromCart = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { productId } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(productId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid product ID');
    }
    const cart = await cart_model_1.Cart.findOne({ user: userId });
    if (!cart) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Cart not found');
    }
    await cart.removeItem(new mongoose_1.Types.ObjectId(productId));
    const updatedCart = await cart_model_1.Cart.findOne({ user: userId }).populate({ path: 'items.product', select: 'name price thumbnail', match: { isDeleted: false } });
    await (0, invalidateCache_1.invalidateCartCaches)({
        cartId: String(cart._id),
        userId: String(userId),
    });
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Item removed from cart successfully', updatedCart));
    return;
});
exports.clearCart = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const cart = await cart_model_1.Cart.findOne({ user: userId });
    if (!cart) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Cart not found');
    }
    await cart.clearCart();
    await (0, invalidateCache_1.invalidateCartCaches)({
        cartId: String(cart._id),
        userId: String(userId),
    });
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Cart cleared successfully', {
        user: userId,
        items: [],
        totalItems: 0,
        totalPrice: 0,
        itemCount: 0,
    }));
    return;
});
exports.getCartSummary = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const cacheKey = redisKeys_1.RedisKeys.CART_SUMMARY_BY_USER(userId);
    const cachedSummary = await redis_1.redis.get(cacheKey);
    if (cachedSummary) {
        res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Cart summary retrieved successfully', cachedSummary));
        return;
    }
    const cart = await cart_model_1.Cart.findOne({ user: userId });
    if (!cart) {
        const summary = {
            totalItems: 0,
            itemCount: 0,
        };
        await redis_1.redis.set(cacheKey, summary, cacheTTL_1.CacheTTL.SHORT);
        res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Cart summary retrieved successfully', summary));
        return;
    }
    const { totalItems, totalPrice } = await cart.getCartSummary();
    const summary = {
        totalItems,
        totalPrice,
    };
    await redis_1.redis.set(cacheKey, summary, cacheTTL_1.CacheTTL.SHORT);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Cart summary retrieved successfully', summary));
    return;
});
exports.checkoutCart = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const cart = await cart_model_1.Cart.findOne({ user: userId }).populate({ path: 'items.product', select: 'originalPrice isDeleted status stock name', match: { isDeleted: false } });
    if (!cart || cart.items.length === 0) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Cart is empty');
    }
    let totalPrice = 0;
    for (const item of cart.items) {
        const product = item.product;
        if (product.isDeleted) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, `Product ${product.name} is not available`);
        }
        // if (item.quantity > product.stock) {
        //   throw new ApiError(status.BAD_REQUEST, `Only ${product.stock} items available in stock for product ${product.name}`);
        // }
        totalPrice += item.quantity * product.originalPrice;
    }
    await (0, invalidateCache_1.invalidateCartCaches)({
        cartId: String(cart._id),
        userId: String(userId),
    });
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Checkout successful', { totalPrice }));
    return;
});
//# sourceMappingURL=cart.controller.js.map