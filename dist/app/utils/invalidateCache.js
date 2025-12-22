"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateProductCaches = invalidateProductCaches;
exports.invalidateOrderCaches = invalidateOrderCaches;
exports.invalidateMessageCaches = invalidateMessageCaches;
exports.invalidateCategoryCaches = invalidateCategoryCaches;
exports.invalidateBrandCaches = invalidateBrandCaches;
exports.invalidateBlogCaches = invalidateBlogCaches;
exports.invalidateBannerCaches = invalidateBannerCaches;
exports.invalidateAddressCaches = invalidateAddressCaches;
exports.invalidateReviewCaches = invalidateReviewCaches;
exports.invalidateCartCaches = invalidateCartCaches;
exports.invalidateWalletCaches = invalidateWalletCaches;
exports.invalidateSettingCaches = invalidateSettingCaches;
exports.invalidateUserCaches = invalidateUserCaches;
exports.invalidateWishlistCaches = invalidateWishlistCaches;
const redis_1 = require("../config/redis");
const redisKeys_1 = require("../utils/redisKeys");
async function invalidateMany({ keys = [], patterns = [], }) {
    const keyDeletes = keys
        .filter(Boolean)
        .map((k) => redis_1.redis.delete(String(k)));
    const patternDeletes = patterns
        .filter(Boolean)
        .map((p) => redis_1.redis.deleteByPattern(String(p)));
    // Execute all in parallel
    await Promise.all([...keyDeletes, ...patternDeletes]);
}
/**
 * Product-related invalidation
 */
async function invalidateProductCaches(params) {
    const { productId, productSlug, categoryId, brandId } = params;
    await invalidateMany({
        keys: [
            // Product-specific keys (these are base keys, patterns will catch all query variations)
            productId ? redisKeys_1.RedisKeys.PRODUCT_BY_ID(String(productId)) : undefined,
            productSlug ? redisKeys_1.RedisKeys.PRODUCT_BY_SLUG(String(productSlug)) : undefined,
            productId ? redisKeys_1.RedisKeys.PRODUCT_RELATED(String(productId)) : undefined,
            // Global product caches
            redisKeys_1.RedisKeys.PRODUCT_FILTERS(),
            // Related entity caches
            categoryId
                ? redisKeys_1.RedisKeys.CATEGORY_BY_ID(String(categoryId), { populate: 'true' })
                : undefined,
            brandId
                ? redisKeys_1.RedisKeys.BRAND_BY_ID(String(brandId), { populate: 'true' })
                : undefined,
            // Dashboard stats
            redisKeys_1.RedisKeys.DASHBOARD_STATS(),
        ],
        patterns: [
            // Invalidate all product list variations
            redisKeys_1.RedisPatterns.PRODUCTS_ALL(),
            // Invalidate all variations of this specific product (by ID)
            productId ? redisKeys_1.RedisPatterns.PRODUCT_ANY(String(productId)) : undefined,
            // Invalidate all variations of this specific product (by slug)
            productSlug ? redisKeys_1.RedisPatterns.PRODUCT_ANY(String(productSlug)) : undefined,
        ],
    });
}
/**
 * Order-related invalidation
 */
async function invalidateOrderCaches(params) {
    const { orderId, userId, touchesProducts = false } = params;
    await invalidateMany({
        keys: [
            orderId ? redisKeys_1.RedisKeys.ORDER_BY_ID(String(orderId)) : undefined,
            redisKeys_1.RedisKeys.DASHBOARD_STATS(),
        ],
        patterns: [
            redisKeys_1.RedisPatterns.ORDERS_ALL(),
            userId ? redisKeys_1.RedisPatterns.ORDERS_BY_USER(String(userId)) : undefined,
            touchesProducts ? redisKeys_1.RedisPatterns.PRODUCTS_ALL() : undefined,
        ],
    });
}
/**
 * Message-related invalidation
 */
async function invalidateMessageCaches(messageId) {
    await invalidateMany({
        keys: [messageId ? redisKeys_1.RedisKeys.MESSAGE_BY_ID(String(messageId)) : undefined],
        patterns: [redisKeys_1.RedisPatterns.MESSAGES_ALL()],
    });
}
/**
 * Category-related invalidation
 */
async function invalidateCategoryCaches(categoryId) {
    await invalidateMany({
        keys: [
            categoryId
                ? redisKeys_1.RedisKeys.CATEGORY_BY_ID(String(categoryId), { populate: 'true' })
                : undefined,
            redisKeys_1.RedisKeys.CATEGORIES_LIST(),
            redisKeys_1.RedisKeys.DASHBOARD_STATS(),
        ],
        patterns: [
            redisKeys_1.RedisPatterns.CATEGORIES_ALL(),
            categoryId ? redisKeys_1.RedisPatterns.CATEGORY_ANY(String(categoryId)) : undefined,
            redisKeys_1.RedisPatterns.DASHBOARD_ALL(),
        ],
    });
}
/**
 * Brand-related invalidation
 */
async function invalidateBrandCaches(brandId) {
    await invalidateMany({
        keys: [
            brandId
                ? redisKeys_1.RedisKeys.BRAND_BY_ID(String(brandId), { populate: 'true' })
                : undefined,
            redisKeys_1.RedisKeys.BRANDS_LIST(),
            redisKeys_1.RedisKeys.DASHBOARD_STATS(),
        ],
        patterns: [
            redisKeys_1.RedisPatterns.BRANDS_ALL(),
            brandId ? redisKeys_1.RedisPatterns.BRAND_ANY(String(brandId)) : undefined,
            redisKeys_1.RedisPatterns.DASHBOARD_ALL(),
        ],
    });
}
/**
 * Blog-related invalidation
 */
async function invalidateBlogCaches(params) {
    const { blogId, slug } = params || {};
    await invalidateMany({
        keys: [
            blogId ? redisKeys_1.RedisKeys.BLOG_BY_ID(String(blogId)) : undefined,
            slug ? redisKeys_1.RedisKeys.BLOG_BY_SLUG(String(slug)) : undefined,
            redisKeys_1.RedisKeys.BLOGS_LIST(),
        ],
        patterns: [redisKeys_1.RedisPatterns.BLOGS_ALL(), blogId ? redisKeys_1.RedisPatterns.BLOG_ANY(String(blogId)) : undefined],
    });
}
/**
 * Banner-related invalidation
 */
async function invalidateBannerCaches(bannerId) {
    await invalidateMany({
        keys: [bannerId ? redisKeys_1.RedisKeys.BANNER_BY_ID(String(bannerId)) : undefined, redisKeys_1.RedisKeys.BANNERS_LIST()],
        patterns: [redisKeys_1.RedisPatterns.BANNERS_ALL(), bannerId ? redisKeys_1.RedisPatterns.BANNER_ANY(String(bannerId)) : undefined],
    });
}
/**
 * Address-related invalidation
 */
async function invalidateAddressCaches(params) {
    const { addressId, userId } = params || {};
    await invalidateMany({
        keys: [
            addressId ? redisKeys_1.RedisKeys.ADDRESS_BY_ID(String(addressId)) : undefined,
            userId ? redisKeys_1.RedisKeys.ADDRESSES_BY_USER(String(userId)) : undefined,
            redisKeys_1.RedisKeys.ADDRESSES_LIST(),
            userId ? redisKeys_1.RedisKeys.USER_BY_ID(String(userId), { populate: 'true' }) : undefined,
        ],
        patterns: [
            redisKeys_1.RedisPatterns.ADDRESSES_ALL(),
            addressId ? redisKeys_1.RedisPatterns.ADDRESS_ANY(String(addressId)) : undefined,
            userId ? redisKeys_1.RedisPatterns.ADDRESSES_BY_USER(String(userId)) : undefined,
        ],
    });
}
/**
 * Review-related invalidation
 */
async function invalidateReviewCaches(params) {
    const { reviewId, productId, userId } = params || {};
    await invalidateMany({
        keys: [
            reviewId ? redisKeys_1.RedisKeys.REVIEW_BY_ID(String(reviewId)) : undefined,
            productId ? redisKeys_1.RedisKeys.REVIEWS_BY_PRODUCT(String(productId)) : undefined,
            userId ? redisKeys_1.RedisKeys.REVIEWS_BY_USER(String(userId)) : undefined,
            redisKeys_1.RedisKeys.REVIEWS_LIST(),
            productId ? redisKeys_1.RedisKeys.PRODUCT_BY_ID(String(productId)) : undefined,
        ],
        patterns: [
            redisKeys_1.RedisPatterns.REVIEWS_ALL(),
            productId ? redisKeys_1.RedisPatterns.REVIEWS_BY_PRODUCT(String(productId)) : undefined,
            userId ? redisKeys_1.RedisPatterns.REVIEWS_BY_USER(String(userId)) : undefined,
            reviewId ? redisKeys_1.RedisPatterns.REVIEW_ANY(String(reviewId)) : undefined,
            productId ? redisKeys_1.RedisPatterns.PRODUCT_ANY(String(productId)) : undefined,
        ],
    });
}
/**
 * Cart-related invalidation
 */
async function invalidateCartCaches(params) {
    const { cartId, userId } = params || {};
    await invalidateMany({
        keys: [
            cartId ? redisKeys_1.RedisKeys.CART_BY_ID(String(cartId)) : undefined,
            userId ? redisKeys_1.RedisKeys.CART_BY_USER(String(userId)) : undefined,
            userId ? redisKeys_1.RedisKeys.CART_SUMMARY_BY_USER(String(userId)) : undefined,
            redisKeys_1.RedisKeys.CARTS_LIST(),
        ],
        patterns: [
            redisKeys_1.RedisPatterns.CARTS_ALL(),
            cartId ? redisKeys_1.RedisPatterns.CART_ANY(String(cartId)) : undefined,
            userId ? redisKeys_1.RedisPatterns.CART_BY_USER_ANY(String(userId)) : undefined,
            userId ? redisKeys_1.RedisPatterns.CART_SUMMARY_ANY(String(userId)) : undefined,
        ],
    });
}
/**
 * Wallet-related invalidation
 */
async function invalidateWalletCaches(userId) {
    await invalidateMany({
        keys: [
            userId ? redisKeys_1.RedisKeys.WALLET_BY_USER(String(userId)) : undefined,
            userId ? redisKeys_1.RedisKeys.WALLET_BALANCE(String(userId)) : undefined,
            userId ? redisKeys_1.RedisKeys.WALLET_TRANSACTIONS(String(userId)) : undefined,
            redisKeys_1.RedisKeys.WALLETS_LIST(),
        ],
        patterns: [redisKeys_1.RedisPatterns.WALLETS_ALL()],
    });
}
/**
 * Setting-related invalidation
 */
async function invalidateSettingCaches(params = {}) {
    const { key } = params;
    await invalidateMany({
        keys: [key ? redisKeys_1.RedisKeys.SETTING_BY_KEY(String(key)) : undefined, redisKeys_1.RedisKeys.SETTINGS_LIST()],
        patterns: [],
    });
}
/**
 * User-related invalidation
 */
async function invalidateUserCaches(userId) {
    await invalidateMany({
        keys: [userId ? redisKeys_1.RedisKeys.USER_BY_ID(String(userId)) : undefined, redisKeys_1.RedisKeys.USERS_LIST()],
        patterns: [redisKeys_1.RedisPatterns.USERS_ALL(), userId ? redisKeys_1.RedisPatterns.USER_ANY(String(userId)) : undefined],
    });
}
/**
 * Wishlist-related invalidation
 */
async function invalidateWishlistCaches(userId) {
    await invalidateMany({
        keys: [userId ? redisKeys_1.RedisKeys.WISHLIST_BY_USER(String(userId)) : undefined],
        patterns: [],
    });
}
//# sourceMappingURL=invalidateCache.js.map