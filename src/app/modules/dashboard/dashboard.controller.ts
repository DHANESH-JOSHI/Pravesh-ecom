import { asyncHandler } from '@/utils';
import { RedisKeys } from '@/utils/redisKeys';
import { redis } from "@/config/redis";
import { getApiResponseClass } from "@/interface";
import status from "http-status";
import { User } from "../user/user.model";
import { Order } from "../order/order.model";
import { Product } from "../product/product.model";
import { IDashboardStats } from "./dashboard.interface";
import { CacheTTL } from "@/utils/cacheTTL";

const ApiResponse = getApiResponseClass("DASHBOARD");

export const getDashboardStats = asyncHandler(async (req, res) => {
  const cacheKey = RedisKeys.DASHBOARD_STATS();
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
    totalProducts,

    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,

    dailyOrdersCount,

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
    trendingProducts,
    topCategories,

    monthlyOrders,
    orderStatusStats,

    // lowStockProducts,
    // outOfStockList,
  ] = await Promise.all([
    User.countDocuments({ isDeleted: false }),
    Order.countDocuments(),
    Product.countDocuments({ isDeleted: false }),

    User.countDocuments({ createdAt: { $gte: today }, isDeleted: false }),
    User.countDocuments({ createdAt: { $gte: weekAgo }, isDeleted: false }),
    User.countDocuments({ createdAt: { $gte: monthAgo }, isDeleted: false }),

    Order.countDocuments({ createdAt: { $gte: today } }),

    Order.countDocuments({ status: 'awaiting_confirmation' }),
    Order.countDocuments({ status: 'processing' }),
    Order.countDocuments({ status: 'shipped' }),
    Order.countDocuments({ status: 'delivered' }),
    Order.countDocuments({ status: 'cancelled' }),

    Product.countDocuments({ stock: 0, isDeleted: false }),
    Product.countDocuments({ stock: { $gt: 0, $lt: 10 }, isDeleted: false }),
    Product.countDocuments({ createdAt: { $gte: monthAgo }, isDeleted: false }),

    Order.find()
      .populate({ path: 'user', select: 'name email', match: { isDeleted: false } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('user status createdAt')
      .lean(),

    Product.find({ isDeleted: false })
      .sort({ totalSold: -1, salesCount: -1 })
      .limit(10)
      .select('name totalSold salesCount reviewCount rating')
      .lean()
      .then(products => products.map(p => ({
        _id: p._id.toString(),
        name: p.name,
        totalSold: p.totalSold || 0,
        salesCount: p.salesCount || 0,
        reviewCount: p.reviewCount || 0,
        rating: p.rating || 0,
      }))),

    Product.find({ isDeleted: false })
      .sort({ salesCount: -1, totalSold: -1 })
      .limit(10)
      .select('name salesCount totalSold reviewCount rating')
      .lean()
      .then(products => products.map(p => ({
        _id: p._id.toString(),
        name: p.name,
        salesCount: p.salesCount || 0,
        totalSold: p.totalSold || 0,
        reviewCount: p.reviewCount || 0,
        rating: p.rating || 0,
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
          pipeline: [
            { $match: { isDeleted: false } },
            { $project: { _id: 1, title: 1 } }
          ],
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category._id',
          name: { $first: '$category.title' },
          totalSold: { $sum: '$totalSold' },
        }
      },
      { $sort: { totalSold: -1 } },
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

    // Product.find({
    //   isDeleted: false,
    //   stock: { $gt: 0, $lt: 10 }
    // })
    //   .sort({ stock: 1 })
    //   .limit(10)
    //   .select('name stock')
    //   .lean(),

    // Product.find({
    //   isDeleted: false,
    //   stock: 0
    // })
    //   .limit(10)
    //   .select('name')
    //   .lean(),

  ]);

  const formattedRecentOrders = recentOrders.map(order => ({
    _id: order._id.toString(),
    user: {
      name: (order.user as any)?.name || 'Unknown',
      email: (order.user as any)?.email || 'Unknown'
    },
    status: order.status,
    createdAt: order.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  }));

  // const formattedLowStockProducts = lowStockProducts.map(product => ({
  //   _id: product._id.toString(),
  //   name: product.name,
  //   // stock: product.stock
  // }));

  // const formattedOutOfStockList = outOfStockList.map(product => ({
  //   _id: product._id.toString(),
  //   name: product.name
  // }));

  const stats: IDashboardStats = {
    totalUsers,
    totalOrders,
    totalProducts,

    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,

    dailyOrdersCount,
    dailyUsersCount: newUsersToday,

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
    trendingProducts,
    topCategories,

    monthlyOrders,
    orderStatusStats,

    // lowStockProducts: formattedLowStockProducts,
    // outOfStockList: formattedOutOfStockList,
  };

  await redis.set(cacheKey, stats, CacheTTL.SHORT);

  res.status(status.OK).json(new ApiResponse(status.OK, "Dashboard stats retrieved successfully", stats));
  return;
});