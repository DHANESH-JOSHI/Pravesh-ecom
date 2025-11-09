import { asyncHandler } from "@/utils";
import { redis } from "@/config/redis";
import { getApiResponseClass } from "@/interface";
import status from "http-status";
import { User } from "../user/user.model";
import { Order } from "../order/order.model";
import { Product } from "../product/product.model";
import { Review } from "../review/review.model";
import { Wishlist } from "../wishlist/wishlist.model";
import { Cart } from "../cart/cart.model";
import { Blog } from "../blog/blog.model";
import { IDashboardStats } from "./dashboard.interface";

const ApiResponse = getApiResponseClass("DASHBOARD");

export const getDashboardStats = asyncHandler(async (req, res) => {
  const cacheKey = 'dashboard:stats';
  const cachedStats = await redis.get(cacheKey);

  if (cachedStats) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "Dashboard stats retrieved successfully", cachedStats));
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalOrders,
    totalRevenue,
    totalProducts,

    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,

    todayRevenue,
    thisWeekRevenue,
    thisMonthRevenue,
    averageOrderValue,

    awaitingConfirmationOrders,
    processingOrders,
    shippedOrders,
    deliveredOrders,
    cancelledOrders,

    outOfStockProducts,
    lowStockProductsCount,
    newProductsThisMonth,

    recentOrders,

    topProducts,
    topCategories,

    monthlyRevenue,
    orderStatusStats,

    lowStockProducts,
    outOfStockList,

    totalReviews,
    averageRating,
    totalWishlistItems,
    totalCartItems,

    totalBlogs,
    publishedBlogs,

    activeUsers
  ] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    Order.countDocuments(),
    Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]).then(result => result[0]?.total || 0),
    Product.countDocuments({ isDeleted: false }),

    User.countDocuments({ createdAt: { $gte: today }, isDeleted: false }),
    User.countDocuments({ createdAt: { $gte: weekAgo }, isDeleted: false }),
    User.countDocuments({ createdAt: { $gte: monthAgo }, isDeleted: false }),

    Order.aggregate([
      { $match: { createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]).then(result => result[0]?.total || 0),
    Order.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]).then(result => result[0]?.total || 0),
    Order.aggregate([
      { $match: { createdAt: { $gte: monthAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]).then(result => result[0]?.total || 0),
    Order.aggregate([
      { $group: { _id: null, avg: { $avg: "$totalAmount" }, count: { $sum: 1 } } }
    ]).then(result => result[0]?.count > 0 ? result[0].avg : 0),

    Order.countDocuments({ status: 'awaiting_confirmation' }),
    Order.countDocuments({ status: 'processing' }),
    Order.countDocuments({ status: 'shipped' }),
    Order.countDocuments({ status: 'delivered' }),
    Order.countDocuments({ status: 'cancelled' }),

    Product.countDocuments({ stock: 0, isDeleted: false }),
    Product.countDocuments({ stock: { $gt: 0, $lt: 10 }, isDeleted: false }),
    Product.countDocuments({ createdAt: { $gte: monthAgo }, isDeleted: false }),

    Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('user totalAmount status createdAt')
      .lean(),

    Product.find({ isDeleted: false, totalSold: { $gt: 0 } })
      .sort({ totalSold: -1 })
      .limit(10)
      .select('name totalSold finalPrice')
      .lean()
      .then(products => products.map(p => ({
        _id: p._id.toString(),
        name: p.name,
        totalSold: p.totalSold || 0,
        revenue: (p.totalSold || 0) * p.originalPrice
      }))),

    Product.aggregate([
      {
        $match: { isDeleted: false, totalSold: { $gt: 0 } }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category._id',
          name: { $first: '$category.title' },
          totalSold: { $sum: '$totalSold' },
          revenue: { $sum: { $multiply: ['$totalSold', '$finalPrice'] } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]),

    Order.aggregate([
      { $match: { createdAt: { $gte: yearAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          month: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              {
                $cond: {
                  if: { $lt: ["$_id.month", 10] },
                  then: { $concat: ["0", { $toString: "$_id.month" }] },
                  else: { $toString: "$_id.month" }
                }
              }
            ]
          },
          revenue: 1,
          orders: 1
        }
      }
    ]),

    Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { status: "$_id", count: 1, _id: 0 } }
    ]).then(result => {
      const stats: { [key: string]: number } = {};
      result.forEach(item => {
        stats[item.status] = item.count;
      });
      return stats;
    }),

    Product.find({
      isDeleted: false,
      stock: { $gt: 0, $lt: 10 }
    })
      .sort({ stock: 1 })
      .limit(10)
      .select('name stock')
      .lean(),

    Product.find({
      isDeleted: false,
      stock: 0
    })
      .limit(10)
      .select('name')
      .lean(),

    Review.countDocuments(),
    Review.aggregate([
      { $group: { _id: null, avg: { $avg: "$rating" } } }
    ]).then(result => result[0]?.avg || 0),

    Wishlist.aggregate([
      { $group: { _id: null, total: { $sum: { $size: "$items" } } } }
    ]).then(result => result[0]?.total || 0),

    Cart.aggregate([
      { $unwind: "$items" },
      { $group: { _id: null, total: { $sum: "$items.quantity" } } }
    ]).then(result => result[0]?.total || 0),

    Blog.countDocuments(),
    Blog.countDocuments({ isPublished: true, isDeleted: false }),

    User.countDocuments({
      isDeleted: false,
      updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).catch(() => 0)
  ]);

  const formattedRecentOrders = recentOrders.map(order => ({
    _id: order._id.toString(),
    user: {
      name: (order.user as any)?.name || 'Unknown',
      email: (order.user as any)?.email || 'Unknown'
    },
    totalAmount: order.totalAmount,
    status: order.status,
    createdAt: order.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  }));

  const formattedLowStockProducts = lowStockProducts.map(product => ({
    _id: product._id.toString(),
    name: product.name,
    // stock: product.stock
  }));

  const formattedOutOfStockList = outOfStockList.map(product => ({
    _id: product._id.toString(),
    name: product.name
  }));

  const stats: IDashboardStats = {
    totalUsers,
    totalOrders,
    totalRevenue,
    totalProducts,

    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,

    todayRevenue,
    thisWeekRevenue,
    thisMonthRevenue,
    averageOrderValue,

    pendingOrders: awaitingConfirmationOrders,
    processingOrders,
    shippedOrders,
    deliveredOrders,
    cancelledOrders,

    outOfStockProducts,
    lowStockProductsCount,
    newProductsThisMonth,

    recentOrders: formattedRecentOrders,

    topProducts,
    topCategories,

    monthlyRevenue,
    orderStatusStats,

    lowStockProducts: formattedLowStockProducts,
    outOfStockList: formattedOutOfStockList,

    totalReviews,
    averageRating,
    totalWishlistItems,
    totalCartItems,

    totalBlogs,
    publishedBlogs,

    activeUsers
  };

  await redis.set(cacheKey, stats, 600);

  res.status(status.OK).json(new ApiResponse(status.OK, "Dashboard stats retrieved successfully", stats));
  return;
});