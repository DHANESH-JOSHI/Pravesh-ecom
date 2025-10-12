import { Router } from "express";
import { authRouter } from "@/modules/auth/auth.routes";
const router = Router();

type Route = {
  path: string;
  route: Router;
}

const moduleRoutes: Route[] = [
  {
    path: '/auth',
    route: authRouter
  }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;