type StringOrUnknown = string | unknown;
import { generateCacheKey } from "./cacheKeyGenerator";

export const RedisKeys = {
  // Product
  PRODUCT_BY_ID: (id: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`product:${id}`, query),
  PRODUCT_BY_SLUG: (slug: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`product:${slug}`, query),
  PRODUCTS_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("products", query),
  PRODUCT_FILTERS: () => "product_filters",
  PRODUCT_RELATED: (id: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`product:${id}:related`, query),

  // Category
  CATEGORY_BY_ID: (id: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`category:${id}`, query),
  CATEGORY_BY_SLUG: (slug: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`category:${slug}`, query),
  CATEGORY_TREE: () => "categories:tree",
  CATEGORY_LEAF: () => "categories:leaf",
  CATEGORIES_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("categories", query),

  // Brand
  BRAND_BY_ID: (id: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`brand:${id}`, query),
  BRAND_BY_SLUG: (slug: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`brand:${slug}`, query),
  BRANDS_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("brands", query),

  // Cart
  CART_BY_ID: (id: StringOrUnknown) => `cart:id:${id}`,
  CART_BY_USER: (userId: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`cart:user:${userId}`, query),
  CART_SUMMARY_BY_USER: (userId: StringOrUnknown) => `cart:summary:${userId}`,
  CARTS_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("carts", query),

  // Order
  ORDER_BY_ID: (id: StringOrUnknown) => `order:${id}`,
  ORDERS_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("orders", query),
  ORDERS_BY_USER: (userId: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`orders:user:${userId}`, query),

  // Review
  REVIEW_BY_ID: (id: StringOrUnknown) => `review:${id}`,
  REVIEWS_BY_PRODUCT: (productId: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`reviews:product:${productId}`, query),
  REVIEWS_BY_USER: (userId: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`reviews:user:${userId}`, query),
  REVIEWS_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("reviews:all", query),

  // Dashboard
  DASHBOARD_STATS: (query: Record<string, any> = {}) =>
    generateCacheKey("dashboard:stats", query),

  // Address
  ADDRESS_BY_ID: (id: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`address:${id}`, query),
  ADDRESSES_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("addresses", query),
  ADDRESSES_BY_USER: (userId: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`addresses:user:${userId}`, query),

  // Banner
  BANNER_BY_ID: (id: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`banner:${id}`, query),
  BANNERS_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("banners", query),

  // Blog
  BLOG_BY_ID: (id: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`blog:${id}`, query),
  BLOG_BY_SLUG: (slug: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`blog:${slug}`, query),
  BLOGS_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("blogs", query),

  // Message
  MESSAGE_BY_ID: (id: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`message:${id}`, query),
  MESSAGES_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("messages", query),

  // Setting
  SETTING_BY_KEY: (key: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`setting:${key}`, query),
  SETTINGS_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("settings", query),

  // User
  USER_BY_ID: (id: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`user:${id}`, query),
  USERS_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("users", query),

  // Wallet
  WALLET_BY_USER: (userId: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`wallet:user:${userId}`, query),
  WALLETS_LIST: (query: Record<string, any> = {}) =>
    generateCacheKey("wallets", query),
  WALLET_BALANCE: (userId: StringOrUnknown) =>
    `wallet:balance:${userId}`,
  WALLET_TRANSACTIONS: (userId: StringOrUnknown) =>
    `wallet:transactions:${userId}`,

  // Wishlist
  WISHLIST_BY_USER: (userId: StringOrUnknown, query: Record<string, any> = {}) =>
    generateCacheKey(`wishlist:user:${userId}`, query),
} as const;

export type RedisKeyBuilders = typeof RedisKeys;

export const RedisPatterns = {
  // Products
  PRODUCTS_ALL: () => "products*",
  PRODUCT_ANY: (idOrSlug: StringOrUnknown) => `product:${idOrSlug}*`,

  // Reviews
  REVIEWS_BY_PRODUCT: (productId: StringOrUnknown) => `reviews:product:${productId}*`,
  REVIEWS_BY_USER: (userId: StringOrUnknown) => `reviews:user:${userId}*`,
  REVIEWS_ALL: () => "reviews:*",
  REVIEW_ANY: (id: StringOrUnknown) => `review:${id}`,

  // Categories
  CATEGORIES_ALL: () => "categories*",
  CATEGORY_ANY: (id: StringOrUnknown) => `category:${id}*`,

  // Brands
  BRANDS_ALL: () => "brands*",
  BRAND_ANY: (id: StringOrUnknown) => `brand:${id}*`,

  // Banners
  BANNERS_ALL: () => "banners*",
  BANNER_ANY: (id: StringOrUnknown) => `banner:${id}*`,

  // Blogs
  BLOGS_ALL: () => "blogs*",
  BLOG_ANY: (id: StringOrUnknown) => `blog:${id}*`,

  // Messages
  MESSAGES_ALL: () => "messages*",
  MESSAGE_ANY: (id: StringOrUnknown) => `message:${id}*`,

  // Addresses
  ADDRESSES_ALL: () => "addresses*",
  ADDRESS_ANY: (id: StringOrUnknown) => `address:${id}*`,
  ADDRESSES_BY_USER: (userId: StringOrUnknown) => `addresses:user:${userId}*`,

  // Users
  USERS_ALL: () => "users*",
  USER_ANY: (id: StringOrUnknown) => `user:${id}*`,

  // Carts
  CARTS_ALL: () => "carts*",
  CART_ANY: (cartId: StringOrUnknown) => `cart:id:${cartId}`,
  CART_BY_USER_ANY: (userId: StringOrUnknown) => `cart:user:${userId}*`,
  CART_SUMMARY_ANY: (userId: StringOrUnknown) => `cart:summary:${userId}`,

  // Orders
  ORDERS_ALL: () => "orders*",
  ORDERS_BY_USER: (userId: StringOrUnknown) => `orders:user:${userId}*`,
  ORDER_ANY: (orderId: StringOrUnknown) => `order:${orderId}`,

  // Wallets
  WALLETS_ALL: () => "wallets*",

  // Dashboard
  DASHBOARD_ALL: () => "dashboard:stats*",

  // Product filters
  PRODUCT_FILTERS: () => "product_filters",
} as const;

export type RedisPatternBuilders = typeof RedisPatterns;