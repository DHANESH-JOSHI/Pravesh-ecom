import { Router } from "express";
import { authRouter } from "@/modules/auth/auth.routes";
import { categoryRouter } from "@/modules/category/category.routes";
import { productRouter } from "@/modules/product/product.routes";
import { walletRouter } from "@/modules/wallet/wallet.routes";
import { brandRouter } from "@/modules/brand/brand.routes";
import { cartRouter } from "@/modules/cart/cart.routes";
import { orderRouter } from '@/modules/order/order.routes';
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
    path: '/wallets',
    route: walletRouter
  },
  {
    path: '/carts',
    route: cartRouter
  },
  {
    path: '/orders',
    route: orderRouter
  }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;