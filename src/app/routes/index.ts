import { Router } from "express";
import { authRouter } from "@/modules/auth/auth.routes";
import { categoryRouter } from "@/modules/category/category.routes";
import { productRouter } from "@/modules/product/product.routes";
import { walletRouter } from "@/modules/wallet/wallet.routes";
import { brandRouter } from "@/modules/brand/brand.routes";
import { cartRouter } from "@/modules/cart/cart.routes";
import { orderRouter } from '@/modules/order/order.routes';
import { userRouter } from "@/modules/user/user.routes";
import { addressRouter } from "@/modules/address/address.routes";
import { reviewRouter } from "@/modules/review/review.routes";
import { bannerRouter } from "@/modules/banner/banner.routes";
import { wishlistRouter } from "@/modules/wishlist/wishlist.routes";
import { blogRouter } from "@/modules/blog/blog.routes";
import { dashboardRouter } from "@/modules/dashboard/dashboard.routes";
import { settingRouter } from "@/modules/setting/setting.routes";
import { messageRouter } from "@/modules/message/message.routes";
const router = Router();

type Route = {
  path: string;
  route: Router;
}

const moduleRoutes: Route[] = [
  {
    path: '/auth',
    route: authRouter
  },
  {
    path: '/users',
    route: userRouter
  },
  {
    path: '/categories',
    route: categoryRouter
  },
  {
    path: '/products',
    route: productRouter
  },
  {
    path: '/brands',
    route: brandRouter
  },
  {
    path: '/wallet',
    route: walletRouter
  },
  {
    path: '/cart',
    route: cartRouter
  },
  {
    path: '/orders',
    route: orderRouter
  },
  {
    path: '/addresses',
    route: addressRouter
  },
  {
    path: '/reviews',
    route: reviewRouter
  },
  {
    path: '/banners',
    route: bannerRouter
  },
  {
    path: '/wishlist',
    route: wishlistRouter
  },
  {
    path: '/blogs',
    route: blogRouter
  },
  {
    path: '/settings',
    route: settingRouter
  },
  {
    path: '/messages',
    route: messageRouter
  },
  {
    path: '/dashboard',
    route: dashboardRouter
  }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;