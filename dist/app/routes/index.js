"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = require("../modules/auth/auth.routes");
const category_routes_1 = require("../modules/category/category.routes");
const product_routes_1 = require("../modules/product/product.routes");
const wallet_routes_1 = require("../modules/wallet/wallet.routes");
const brand_routes_1 = require("../modules/brand/brand.routes");
const cart_routes_1 = require("../modules/cart/cart.routes");
const order_routes_1 = require("../modules/order/order.routes");
const user_routes_1 = require("../modules/user/user.routes");
const address_routes_1 = require("../modules/address/address.routes");
const review_routes_1 = require("../modules/review/review.routes");
const banner_routes_1 = require("../modules/banner/banner.routes");
const wishlist_routes_1 = require("../modules/wishlist/wishlist.routes");
const blog_routes_1 = require("../modules/blog/blog.routes");
const dashboard_routes_1 = require("../modules/dashboard/dashboard.routes");
const setting_routes_1 = require("../modules/setting/setting.routes");
const contact_routes_1 = require("../modules/contact/contact.routes");
const router = (0, express_1.Router)();
const moduleRoutes = [
    {
        path: '/auth',
        route: auth_routes_1.authRouter
    },
    {
        path: '/users',
        route: user_routes_1.userRouter
    },
    {
        path: '/categories',
        route: category_routes_1.categoryRouter
    },
    {
        path: '/products',
        route: product_routes_1.productRouter
    },
    {
        path: '/brands',
        route: brand_routes_1.brandRouter
    },
    {
        path: '/wallet',
        route: wallet_routes_1.walletRouter
    },
    {
        path: '/cart',
        route: cart_routes_1.cartRouter
    },
    {
        path: '/orders',
        route: order_routes_1.orderRouter
    },
    {
        path: '/addresses',
        route: address_routes_1.addressRouter
    },
    {
        path: '/reviews',
        route: review_routes_1.reviewRouter
    },
    {
        path: '/banners',
        route: banner_routes_1.bannerRouter
    },
    {
        path: '/wishlist',
        route: wishlist_routes_1.wishlistRouter
    },
    {
        path: '/blogs',
        route: blog_routes_1.blogRouter
    },
    {
        path: '/settings',
        route: setting_routes_1.settingRouter
    },
    {
        path: '/contact',
        route: contact_routes_1.contactRouter
    },
    {
        path: '/dashboard',
        route: dashboard_routes_1.dashboardRouter
    }
];
moduleRoutes.forEach((route) => router.use(route.path, route.route));
exports.default = router;
//# sourceMappingURL=index.js.map