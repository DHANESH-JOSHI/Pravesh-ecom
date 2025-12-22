"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = void 0;
const utils_1 = require("../../utils");
const redisKeys_1 = require("../../utils/redisKeys");
const redis_1 = require("../../config/redis");
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const user_model_1 = require("../user/user.model");
const order_model_1 = require("../order/order.model");
const product_model_1 = require("../product/product.model");
const cacheTTL_1 = require("../../utils/cacheTTL");
const ApiResponse = (0, interface_1.getApiResponseClass)("DASHBOARD");
exports.getDashboardStats = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = redisKeys_1.RedisKeys.DASHBOARD_STATS();
    const cachedStats = await redis_1.redis.get(cacheKey);
    if (cachedStats) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Dashboard stats retrieved successfully", cachedStats));
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const [totalUsers, totalOrders, totalProducts, newUsersToday, newUsersThisWeek, newUsersThisMonth, awaitingConfirmationOrders, processingOrders, shippedOrders, deliveredOrders, cancelledOrders, outOfStockProducts, lowStockProductsCount, newProductsThisMonth, recentOrders, topProducts, trendingProducts, topCategories, monthlyOrders, orderStatusStats,
    // lowStockProducts,
    // outOfStockList,
    ] = await Promise.all([
        user_model_1.User.countDocuments({ isDeleted: false }),
        order_model_1.Order.countDocuments(),
        product_model_1.Product.countDocuments({ isDeleted: false }),
        user_model_1.User.countDocuments({ createdAt: { $gte: today }, isDeleted: false }),
        user_model_1.User.countDocuments({ createdAt: { $gte: weekAgo }, isDeleted: false }),
        user_model_1.User.countDocuments({ createdAt: { $gte: monthAgo }, isDeleted: false }),
        order_model_1.Order.countDocuments({ status: 'awaiting_confirmation' }),
        order_model_1.Order.countDocuments({ status: 'processing' }),
        order_model_1.Order.countDocuments({ status: 'shipped' }),
        order_model_1.Order.countDocuments({ status: 'delivered' }),
        order_model_1.Order.countDocuments({ status: 'cancelled' }),
        product_model_1.Product.countDocuments({ stock: 0, isDeleted: false }),
        product_model_1.Product.countDocuments({ stock: { $gt: 0, $lt: 10 }, isDeleted: false }),
        product_model_1.Product.countDocuments({ createdAt: { $gte: monthAgo }, isDeleted: false }),
        order_model_1.Order.find()
            .populate({ path: 'user', select: 'name email', match: { isDeleted: false } })
            .sort({ createdAt: -1 })
            .limit(10)
            .select('user status createdAt')
            .lean(),
        product_model_1.Product.find({ isDeleted: false })
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
        product_model_1.Product.find({ isDeleted: false })
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
        product_model_1.Product.aggregate([
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
        order_model_1.Order.aggregate([
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
        order_model_1.Order.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { status: "$_id", count: 1, _id: 0 } }
        ]).then(result => {
            const stats = {};
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
            name: order.user?.name || 'Unknown',
            email: order.user?.email || 'Unknown'
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
    const stats = {
        totalUsers,
        totalOrders,
        totalProducts,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
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
    await redis_1.redis.set(cacheKey, stats, cacheTTL_1.CacheTTL.SHORT);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Dashboard stats retrieved successfully", stats));
    return;
});
//# sourceMappingURL=dashboard.controller.js.map