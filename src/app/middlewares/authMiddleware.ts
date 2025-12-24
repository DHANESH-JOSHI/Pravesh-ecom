import { Response, NextFunction, Request } from "express";
import jwt from "jsonwebtoken";
import { User } from "@/modules/user/user.model";
import config from "@/config";
import { ApiError } from "@/interface";
import status from "http-status";
import { redis } from "@/config/redis";
import { RedisKeys } from "@/utils/redisKeys";
import { IUser } from "@/modules/user/user.interface";
import { Payload } from "@/utils";
import { CacheTTL } from "@/utils/cacheTTL";

export const auth = (...requiredRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.accessToken || req.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new ApiError(status.UNAUTHORIZED, "Authentication required. No token provided", "AUTH_MIDDLEWARE"));
      }

      const decoded = jwt.verify(token, config.JWT_SECRET) as Payload;

      const cacheKey = RedisKeys.USER_BY_ID(decoded.userId);
      let user: IUser | null = await redis.get(cacheKey);

      if (!user) {
        user = await User.findById(decoded.userId);
      }

      if (!user) {
        return next(new ApiError(status.NOT_FOUND, "User not found", "AUTH_MIDDLEWARE"));
      }
      const userObj = (user as any).toJSON ? (user as any).toJSON() : user;
      const { password: _, otp, otpExpires, ...userObject } = userObj;
      req.user = userObject as IUser;
      await redis.set(cacheKey, userObject, CacheTTL.SHORT);

      if (requiredRoles.length > 0) {
        const userRole = user.role;
        if (!requiredRoles.includes(userRole)) {
          return next(new ApiError(status.FORBIDDEN, "You do not have permission to perform this action", "AUTH_MIDDLEWARE"));
        }
      }
      next();
    } catch (error) {
      next(new ApiError(status.UNAUTHORIZED, "Invalid or expired token", "AUTH_MIDDLEWARE"));
    }
  }
};

export const optionalAuth = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.accessToken || req.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next();
      }

      try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as Payload;

        const cacheKey = RedisKeys.USER_BY_ID(decoded.userId);
        let user: IUser | null = await redis.get(cacheKey);

        if (!user) {
          user = await User.findById(decoded.userId);
        }

        if (user) {
          const userObj = (user as any).toJSON ? (user as any).toJSON() : user;
          const { password: _, otp, otpExpires, ...userObject } = userObj;
          req.user = userObject as IUser;
          await redis.set(cacheKey, userObject, CacheTTL.SHORT);
        }
      } catch (error) {
        console.log("Invalid or expired token");
      }

      next();
    } catch (error) {
      next();
    }
  }
};