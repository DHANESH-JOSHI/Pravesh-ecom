"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisPatterns = exports.RedisKeys = void 0;
const cacheKeyGenerator_1 = require("./cacheKeyGenerator");
exports.RedisKeys = {
    // Product
    PRODUCT_BY_ID: (id, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`product:${id}`, query),
    PRODUCT_BY_SLUG: (slug, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`product:${slug}`, query),
    PRODUCTS_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("products", query),
    PRODUCT_FILTERS: () => "product_filters",
    PRODUCT_RELATED: (id, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`product:${id}:related`, query),
    // Category
    CATEGORY_BY_ID: (id, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`category:${id}`, query),
    CATEGORY_BY_SLUG: (slug, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`category:${slug}`, query),
    CATEGORY_TREE: () => "categories:tree",
    CATEGORY_LEAF: () => "categories:leaf",
    CATEGORIES_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("categories", query),
    // Brand
    BRAND_BY_ID: (id, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`brand:${id}`, query),
    BRAND_BY_SLUG: (slug, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`brand:${slug}`, query),
    BRANDS_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("brands", query),
    // Cart
    CART_BY_ID: (id) => `cart:id:${id}`,
    CART_BY_USER: (userId, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`cart:user:${userId}`, query),
    CART_SUMMARY_BY_USER: (userId) => `cart:summary:${userId}`,
    CARTS_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("carts", query),
    // Order
    ORDER_BY_ID: (id) => `order:${id}`,
    ORDERS_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("orders", query),
    ORDERS_BY_USER: (userId, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`orders:user:${userId}`, query),
    // Review
    REVIEW_BY_ID: (id) => `review:${id}`,
    REVIEWS_BY_PRODUCT: (productId, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`reviews:product:${productId}`, query),
    REVIEWS_BY_USER: (userId, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`reviews:user:${userId}`, query),
    REVIEWS_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("reviews:all", query),
    // Dashboard
    DASHBOARD_STATS: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("dashboard:stats", query),
    // Address
    ADDRESS_BY_ID: (id, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`address:${id}`, query),
    ADDRESSES_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("addresses", query),
    ADDRESSES_BY_USER: (userId, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`addresses:user:${userId}`, query),
    // Banner
    BANNER_BY_ID: (id, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`banner:${id}`, query),
    BANNERS_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("banners", query),
    // Blog
    BLOG_BY_ID: (id, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`blog:${id}`, query),
    BLOG_BY_SLUG: (slug, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`blog:${slug}`, query),
    BLOGS_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("blogs", query),
    // Message
    MESSAGE_BY_ID: (id, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`message:${id}`, query),
    MESSAGES_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("messages", query),
    // Setting
    SETTING_BY_KEY: (key, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`setting:${key}`, query),
    SETTINGS_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("settings", query),
    // User
    USER_BY_ID: (id, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`user:${id}`, query),
    USERS_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("users", query),
    // Wallet
    WALLET_BY_USER: (userId, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`wallet:user:${userId}`, query),
    WALLETS_LIST: (query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)("wallets", query),
    WALLET_BALANCE: (userId) => `wallet:balance:${userId}`,
    WALLET_TRANSACTIONS: (userId) => `wallet:transactions:${userId}`,
    // Wishlist
    WISHLIST_BY_USER: (userId, query = {}) => (0, cacheKeyGenerator_1.generateCacheKey)(`wishlist:user:${userId}`, query),
};
exports.RedisPatterns = {
    // Products
    PRODUCTS_ALL: () => "products*",
    PRODUCT_ANY: (idOrSlug) => `product:${idOrSlug}*`,
    // Reviews
    REVIEWS_BY_PRODUCT: (productId) => `reviews:product:${productId}*`,
    REVIEWS_BY_USER: (userId) => `reviews:user:${userId}*`,
    REVIEWS_ALL: () => "reviews:*",
    REVIEW_ANY: (id) => `review:${id}`,
    // Categories
    CATEGORIES_ALL: () => "categories*",
    CATEGORY_ANY: (id) => `category:${id}*`,
    // Brands
    BRANDS_ALL: () => "brands*",
    BRAND_ANY: (id) => `brand:${id}*`,
    // Banners
    BANNERS_ALL: () => "banners*",
    BANNER_ANY: (id) => `banner:${id}*`,
    // Blogs
    BLOGS_ALL: () => "blogs*",
    BLOG_ANY: (id) => `blog:${id}*`,
    // Messages
    MESSAGES_ALL: () => "messages*",
    MESSAGE_ANY: (id) => `message:${id}*`,
    // Addresses
    ADDRESSES_ALL: () => "addresses*",
    ADDRESS_ANY: (id) => `address:${id}*`,
    ADDRESSES_BY_USER: (userId) => `addresses:user:${userId}*`,
    // Users
    USERS_ALL: () => "users*",
    USER_ANY: (id) => `user:${id}*`,
    // Carts
    CARTS_ALL: () => "carts*",
    CART_ANY: (cartId) => `cart:id:${cartId}`,
    CART_BY_USER_ANY: (userId) => `cart:user:${userId}*`,
    CART_SUMMARY_ANY: (userId) => `cart:summary:${userId}`,
    // Orders
    ORDERS_ALL: () => "orders*",
    ORDERS_BY_USER: (userId) => `orders:user:${userId}*`,
    ORDER_ANY: (orderId) => `order:${orderId}`,
    // Wallets
    WALLETS_ALL: () => "wallets*",
    // Dashboard
    DASHBOARD_ALL: () => "dashboard:stats*",
    // Product filters
    PRODUCT_FILTERS: () => "product_filters",
};
//# sourceMappingURL=redisKeys.js.map