import { Response, NextFunction, Request } from "express";
import jwt from "jsonwebtoken";
import { User } from "@/modules/user/user.model";
import config from "@/config";
import { ApiError } from "@/interface";
import status from "http-status";
import { redis } from "@/config/redis";
import { IUser } from "@/modules/user/user.interface";
import { Payload } from "@/utils";

export const auth = (...requiredRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.accessToken || req.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new ApiError(status.UNAUTHORIZED, "Authentication required. No token provided", "AUTH_MIDDLEWARE"));
      }

      const decoded = jwt.verify(token, config.JWT_SECRET) as Payload;

      const cacheKey = `user:${decoded.userId}`;
      let user: IUser | null = await redis.get(cacheKey);

      if (!user) {
        user = await User.findById(decoded.userId);
        if (user) {
          await redis.set(cacheKey, user, 600);
        }
      }

      if (!user) {
        return next(new ApiError(status.UNAUTHORIZED, "User not found", "AUTH_MIDDLEWARE"));
      }
      const userObj = (user as any).toJSON ? (user as any).toJSON() : user;
      const { password: _, otp, otpExpires, ...userObject } = userObj;
      req.user = userObject as IUser;

      if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
        return next(new ApiError(status.UNAUTHORIZED, "You do not have permission to perform this action", "AUTH_MIDDLEWARE"));
      }
      next();
    } catch (error) {
      next(new ApiError(status.UNAUTHORIZED, "Invalid or expired token", "AUTH_MIDDLEWARE"));
    }
  }
};
