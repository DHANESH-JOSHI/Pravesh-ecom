import { redis } from '@/config/redis';
import { RedisKeys, RedisPatterns } from '@/utils/redisKeys';

type MaybeString = string | undefined | null;

async function invalidateMany({
  keys = [],
  patterns = [],
}: {
  keys?: Array<MaybeString>;
  patterns?: Array<MaybeString>;
}) {
  const keyDeletes = keys
    .filter(Boolean)
    .map((k) => redis.delete(String(k)));
  const patternDeletes = patterns
    .filter(Boolean)
    .map((p) => redis.deleteByPattern(String(p)));

  // Execute all in parallel
  await Promise.all([...keyDeletes, ...patternDeletes]);
}

/**
 * Product-related invalidation
 */
export async function invalidateProductCaches(params: {
  productId?: MaybeString;
  productSlug?: MaybeString;
  categoryId?: MaybeString;
  brandId?: MaybeString;
}) {
  const { productId, productSlug, categoryId, brandId } = params;

  await invalidateMany({
    keys: [
      // Product-specific keys (these are base keys, patterns will catch all query variations)
      productId ? RedisKeys.PRODUCT_BY_ID(String(productId)) : undefined,
      productSlug ? RedisKeys.PRODUCT_BY_SLUG(String(productSlug)) : undefined,
      productId ? RedisKeys.PRODUCT_RELATED(String(productId)) : undefined,
      // Global product caches
      RedisKeys.PRODUCT_FILTERS(),
      // Related entity caches
      categoryId
        ? RedisKeys.CATEGORY_BY_ID(String(categoryId), { populate: 'true' })
        : undefined,
      brandId
        ? RedisKeys.BRAND_BY_ID(String(brandId), { populate: 'true' })
        : undefined,
      // Dashboard stats
      RedisKeys.DASHBOARD_STATS(),
    ],
    patterns: [
      // Invalidate all product list variations
      RedisPatterns.PRODUCTS_ALL(),
      // Invalidate all variations of this specific product (by ID)
      productId ? RedisPatterns.PRODUCT_ANY(String(productId)) : undefined,
      // Invalidate all variations of this specific product (by slug)
      productSlug ? RedisPatterns.PRODUCT_ANY(String(productSlug)) : undefined,
    ],
  });
}

/**
 * Order-related invalidation
 */
export async function invalidateOrderCaches(params: {
  orderId?: MaybeString;
  userId?: MaybeString;
  touchesProducts?: boolean;
}) {
  const { orderId, userId, touchesProducts = false } = params;

  await invalidateMany({
    keys: [
      orderId ? RedisKeys.ORDER_BY_ID(String(orderId)) : undefined,
      RedisKeys.DASHBOARD_STATS(),
    ],
    patterns: [
      RedisPatterns.ORDERS_ALL(),
      userId ? RedisPatterns.ORDERS_BY_USER(String(userId)) : undefined,
      touchesProducts ? RedisPatterns.PRODUCTS_ALL() : undefined,
    ],
  });
}

/**
 * Message-related invalidation
 */
export async function invalidateMessageCaches(messageId?: MaybeString) {
  await invalidateMany({
    keys: [messageId ? RedisKeys.MESSAGE_BY_ID(String(messageId)) : undefined],
    patterns: [RedisPatterns.MESSAGES_ALL()],
  });
}

/**
 * Category-related invalidation
 */
export async function invalidateCategoryCaches(categoryId?: MaybeString) {
  await invalidateMany({
    keys: [
      categoryId
        ? RedisKeys.CATEGORY_BY_ID(String(categoryId), { populate: 'true' })
        : undefined,
      RedisKeys.CATEGORIES_LIST(),
      RedisKeys.DASHBOARD_STATS(),
    ],
    patterns: [
      RedisPatterns.CATEGORIES_ALL(),
      categoryId ? RedisPatterns.CATEGORY_ANY(String(categoryId)) : undefined,
      RedisPatterns.DASHBOARD_ALL(),
    ],
  });
}

/**
 * Brand-related invalidation
 */
export async function invalidateBrandCaches(brandId?: MaybeString) {
  await invalidateMany({
    keys: [
      brandId
        ? RedisKeys.BRAND_BY_ID(String(brandId), { populate: 'true' })
        : undefined,
      RedisKeys.BRANDS_LIST(),
      RedisKeys.DASHBOARD_STATS(),
    ],
    patterns: [
      RedisPatterns.BRANDS_ALL(),
      brandId ? RedisPatterns.BRAND_ANY(String(brandId)) : undefined,
      RedisPatterns.DASHBOARD_ALL(),
    ],
  });
}

/**
 * Blog-related invalidation
 */
export async function invalidateBlogCaches(params: {
  blogId?: MaybeString;
  slug?: MaybeString;
}) {
  const { blogId, slug } = params || {};
  await invalidateMany({
    keys: [
      blogId ? RedisKeys.BLOG_BY_ID(String(blogId)) : undefined,
      slug ? RedisKeys.BLOG_BY_SLUG(String(slug)) : undefined,
      RedisKeys.BLOGS_LIST(),
    ],
    patterns: [RedisPatterns.BLOGS_ALL(), blogId ? RedisPatterns.BLOG_ANY(String(blogId)) : undefined],
  });
}

/**
 * Banner-related invalidation
 */
export async function invalidateBannerCaches(bannerId?: MaybeString) {
  await invalidateMany({
    keys: [bannerId ? RedisKeys.BANNER_BY_ID(String(bannerId)) : undefined, RedisKeys.BANNERS_LIST()],
    patterns: [RedisPatterns.BANNERS_ALL(), bannerId ? RedisPatterns.BANNER_ANY(String(bannerId)) : undefined],
  });
}

/**
 * Address-related invalidation
 */
export async function invalidateAddressCaches(params: {
  addressId?: MaybeString;
  userId?: MaybeString;
}) {
  const { addressId, userId } = params || {};
  await invalidateMany({
    keys: [
      addressId ? RedisKeys.ADDRESS_BY_ID(String(addressId)) : undefined,
      userId ? RedisKeys.ADDRESSES_BY_USER(String(userId)) : undefined,
      RedisKeys.ADDRESSES_LIST(),
      userId ? RedisKeys.USER_BY_ID(String(userId), { populate: 'true' }) : undefined,
    ],
    patterns: [
      RedisPatterns.ADDRESSES_ALL(),
      addressId ? RedisPatterns.ADDRESS_ANY(String(addressId)) : undefined,
      userId ? RedisPatterns.ADDRESSES_BY_USER(String(userId)) : undefined,
    ],
  });
}

/**
 * Review-related invalidation
 */
export async function invalidateReviewCaches(params: {
  reviewId?: MaybeString;
  productId?: MaybeString;
  userId?: MaybeString;
}) {
  const { reviewId, productId, userId } = params || {};
  await invalidateMany({
    keys: [
      reviewId ? RedisKeys.REVIEW_BY_ID(String(reviewId)) : undefined,
      productId ? RedisKeys.REVIEWS_BY_PRODUCT(String(productId)) : undefined,
      userId ? RedisKeys.REVIEWS_BY_USER(String(userId)) : undefined,
      RedisKeys.REVIEWS_LIST(),
      productId ? RedisKeys.PRODUCT_BY_ID(String(productId)) : undefined,
    ],
    patterns: [
      RedisPatterns.REVIEWS_ALL(),
      productId ? RedisPatterns.REVIEWS_BY_PRODUCT(String(productId)) : undefined,
      userId ? RedisPatterns.REVIEWS_BY_USER(String(userId)) : undefined,
      reviewId ? RedisPatterns.REVIEW_ANY(String(reviewId)) : undefined,
      productId ? RedisPatterns.PRODUCT_ANY(String(productId)) : undefined,
    ],
  });
}

/**
 * Cart-related invalidation
 */
export async function invalidateCartCaches(params: {
  cartId?: MaybeString;
  userId?: MaybeString;
}) {
  const { cartId, userId } = params || {};
  await invalidateMany({
    keys: [
      cartId ? RedisKeys.CART_BY_ID(String(cartId)) : undefined,
      userId ? RedisKeys.CART_BY_USER(String(userId)) : undefined,
      userId ? RedisKeys.CART_SUMMARY_BY_USER(String(userId)) : undefined,
      RedisKeys.CARTS_LIST(),
    ],
    patterns: [
      RedisPatterns.CARTS_ALL(),
      cartId ? RedisPatterns.CART_ANY(String(cartId)) : undefined,
      userId ? RedisPatterns.CART_BY_USER_ANY(String(userId)) : undefined,
      userId ? RedisPatterns.CART_SUMMARY_ANY(String(userId)) : undefined,
    ],
  });
}

/**
 * Wallet-related invalidation
 */
export async function invalidateWalletCaches(userId?: MaybeString) {
  await invalidateMany({
    keys: [
      userId ? RedisKeys.WALLET_BY_USER(String(userId)) : undefined,
      userId ? RedisKeys.WALLET_BALANCE(String(userId)) : undefined,
      userId ? RedisKeys.WALLET_TRANSACTIONS(String(userId)) : undefined,
      RedisKeys.WALLETS_LIST(),
    ],
    patterns: [RedisPatterns.WALLETS_ALL()],
  });
}

/**
 * Setting-related invalidation
 */
export async function invalidateSettingCaches(params: { key?: MaybeString } = {}) {
  const { key } = params;
  await invalidateMany({
    keys: [key ? RedisKeys.SETTING_BY_KEY(String(key)) : undefined, RedisKeys.SETTINGS_LIST()],
    patterns: [],
  });
}

/**
 * User-related invalidation
 */
export async function invalidateUserCaches(userId?: MaybeString) {
  await invalidateMany({
    keys: [userId ? RedisKeys.USER_BY_ID(String(userId)) : undefined, RedisKeys.USERS_LIST()],
    patterns: [RedisPatterns.USERS_ALL(), userId ? RedisPatterns.USER_ANY(String(userId)) : undefined],
  });
}

/**
 * Wishlist-related invalidation
 */
export async function invalidateWishlistCaches(userId?: MaybeString) {
  await invalidateMany({
    keys: [userId ? RedisKeys.WISHLIST_BY_USER(String(userId)) : undefined],
    patterns: [],
  });
}