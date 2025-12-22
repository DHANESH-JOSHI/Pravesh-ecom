"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeProductFromWishlist = exports.addProductToWishlist = exports.getWishlist = void 0;
const utils_1 = require("../../utils");
const redisKeys_1 = require("../../utils/redisKeys");
const cacheTTL_1 = require("../../utils/cacheTTL");
const redis_1 = require("../../config/redis");
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const wishlist_model_1 = require("./wishlist.model");
const wishlist_validation_1 = require("./wishlist.validation");
const product_model_1 = require("../product/product.model");
const redisKeys_2 = require("../../utils/redisKeys");
const ApiError = (0, interface_1.getApiErrorClass)('WISHLIST');
const ApiResponse = (0, interface_1.getApiResponseClass)('WISHLIST');
exports.getWishlist = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const cacheKey = redisKeys_1.RedisKeys.WISHLIST_BY_USER(String(userId));
    const cachedWishlist = await redis_1.redis.get(cacheKey);
    if (cachedWishlist) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Wishlist retrieved successfully', cachedWishlist));
    }
    let wishlist = await wishlist_model_1.Wishlist.findOne({ user: userId }).populate({
        path: 'items',
        match: { isDeleted: false },
    });
    if (!wishlist) {
        wishlist = await wishlist_model_1.Wishlist.create({ user: userId, items: [] });
    }
    const wishlistObj = wishlist?.toObject ? wishlist.toObject() : wishlist;
    await redis_1.redis.set(cacheKey, wishlistObj, cacheTTL_1.CacheTTL.MEDIUM);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Wishlist retrieved successfully', wishlist));
    return;
});
exports.addProductToWishlist = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { productId } = wishlist_validation_1.addOrRemoveProductValidation.parse(req.body);
    const product = await product_model_1.Product.findOne({ _id: productId, isDeleted: false });
    if (!product) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found');
    }
    let wishlist = await wishlist_model_1.Wishlist.findOne({ user: userId });
    if (!wishlist) {
        wishlist = await wishlist_model_1.Wishlist.create({ user: userId, items: [productId] });
    }
    else {
        if (!wishlist.items.includes(product._id)) {
            wishlist.items.push(product._id);
            await wishlist.save();
        }
    }
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.WISHLIST_BY_USER_ANY(String(userId)));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.USER_ANY(String(userId)));
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, `Product '${product.name}' added to wishlist`, wishlist));
    return;
});
exports.removeProductFromWishlist = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { productId } = wishlist_validation_1.addOrRemoveProductValidation.parse(req.body);
    const wishlist = await wishlist_model_1.Wishlist.findOne({ user: userId });
    if (!wishlist) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Wishlist not found');
    }
    const initialLength = wishlist.items.length;
    wishlist.items = wishlist.items.filter((id) => id.toString() !== productId.toString());
    if (initialLength === wishlist.items.length) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Product not found in wishlist');
    }
    await wishlist.save();
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.WISHLIST_BY_USER_ANY(String(userId)));
    await redis_1.redis.deleteByPattern(redisKeys_2.RedisPatterns.USER_ANY(String(userId)));
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Product removed from wishlist successfully', wishlist));
    return;
});
//# sourceMappingURL=wishlist.controller.js.map