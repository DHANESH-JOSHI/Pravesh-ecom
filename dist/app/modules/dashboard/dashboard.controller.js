"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = void 0;
const utils_1 = require("../../utils");
const redis_1 = require("../../config/redis");
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const user_model_1 = require("../user/user.model");
const order_model_1 = require("../order/order.model");
const product_model_1 = require("../product/product.model");
const review_model_1 = require("../review/review.model");
const wishlist_model_1 = require("../wishlist/wishlist.model");
const cart_model_1 = require("../cart/cart.model");
const blog_model_1 = require("../blog/blog.model");
const ApiResponse = (0, interface_1.getApiResponseClass)("DASHBOARD");
exports.getDashboardStats = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = 'dashboard:stats';
    const cachedStats = await redis_1.redis.get(cacheKey);
    if (cachedStats) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Dashboard stats retrieved successfully", cachedStats));
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const [totalUsers, totalOrders, totalRevenue, totalProducts, newUsersToday, newUsersThisWeek, newUsersThisMonth, todayRevenue, thisWeekRevenue, thisMonthRevenue, averageOrderValue, awaitingConfirmationOrders, processingOrders, shippedOrders, deliveredOrders, cancelledOrders, outOfStockProducts, lowStockProductsCount, newProductsThisMonth, recentOrders, topProducts, topCategories, monthlyRevenue, orderStatusStats, 
    // lowStockProducts,
    // outOfStockList,
    totalReviews, averageRating, totalWishlistItems, totalCartItems, totalBlogs, publishedBlogs, activeUsers] = await Promise.all([
        user_model_1.User.countDocuments({ isDeleted: false }),
        order_model_1.Order.countDocuments(),
        order_model_1.Order.aggregate([
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]).then(result => result[0]?.total || 0),
        product_model_1.Product.countDocuments({ isDeleted: false }),
        user_model_1.User.countDocuments({ createdAt: { $gte: today }, isDeleted: false }),
        user_model_1.User.countDocuments({ createdAt: { $gte: weekAgo }, isDeleted: false }),
        user_model_1.User.countDocuments({ createdAt: { $gte: monthAgo }, isDeleted: false }),
        order_model_1.Order.aggregate([
            { $match: { createdAt: { $gte: today } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]).then(result => result[0]?.total || 0),
        order_model_1.Order.aggregate([
            { $match: { createdAt: { $gte: weekAgo } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]).then(result => result[0]?.total || 0),
        order_model_1.Order.aggregate([
            { $match: { createdAt: { $gte: monthAgo } } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]).then(result => result[0]?.total || 0),
        order_model_1.Order.aggregate([
            { $group: { _id: null, avg: { $avg: "$totalAmount" }, count: { $sum: 1 } } }
        ]).then(result => result[0]?.count > 0 ? result[0].avg : 0),
        order_model_1.Order.countDocuments({ status: 'awaiting_confirmation' }),
        order_model_1.Order.countDocuments({ status: 'processing' }),
        order_model_1.Order.countDocuments({ status: 'shipped' }),
        order_model_1.Order.countDocuments({ status: 'delivered' }),
        order_model_1.Order.countDocuments({ status: 'cancelled' }),
        product_model_1.Product.countDocuments({ stock: 0, isDeleted: false }),
        product_model_1.Product.countDocuments({ stock: { $gt: 0, $lt: 10 }, isDeleted: false }),
        product_model_1.Product.countDocuments({ createdAt: { $gte: monthAgo }, isDeleted: false }),
        order_model_1.Order.find()
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .limit(10)
            .select('user totalAmount status createdAt')
            .lean(),
        product_model_1.Product.find({ isDeleted: false, totalSold: { $gt: 0 } })
            .sort({ totalSold: -1 })
            .limit(10)
            .select('name totalSold originalPrice')
            .lean()
            .then(products => products.map(p => ({
            _id: p._id.toString(),
            name: p.name,
            totalSold: p.totalSold || 0,
            revenue: (p.totalSold || 0) * p.originalPrice
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
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            {
                $group: {
                    _id: '$category._id',
                    name: { $first: '$category.title' },
                    totalSold: { $sum: '$totalSold' },
                    revenue: { $sum: { $multiply: ['$totalSold', '$originalPrice'] } }
                }
            },
            { $sort: { revenue: -1 } },
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
        review_model_1.Review.countDocuments(),
        review_model_1.Review.aggregate([
            { $group: { _id: null, avg: { $avg: "$rating" } } }
        ]).then(result => result[0]?.avg || 0),
        wishlist_model_1.Wishlist.aggregate([
            { $group: { _id: null, total: { $sum: { $size: "$items" } } } }
        ]).then(result => result[0]?.total || 0),
        cart_model_1.Cart.aggregate([
            { $unwind: "$items" },
            { $group: { _id: null, total: { $sum: "$items.quantity" } } }
        ]).then(result => result[0]?.total || 0),
        blog_model_1.Blog.countDocuments(),
        blog_model_1.Blog.countDocuments({ isPublished: true, isDeleted: false }),
        user_model_1.User.countDocuments({
            isDeleted: false,
            updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }).catch(() => 0)
    ]);
    const formattedRecentOrders = recentOrders.map(order => ({
        _id: order._id.toString(),
        user: {
            name: order.user?.name || 'Unknown',
            email: order.user?.email || 'Unknown'
        },
        totalAmount: order.totalAmount,
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
        // lowStockProducts: formattedLowStockProducts,
        // outOfStockList: formattedOutOfStockList,
        totalReviews,
        averageRating,
        totalWishlistItems,
        totalCartItems,
        totalBlogs,
        publishedBlogs,
        activeUsers
    };
    await redis_1.redis.set(cacheKey, stats, 600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Dashboard stats retrieved successfully", stats));
    return;
});
//# sourceMappingURL=dashboard.controller.js.map