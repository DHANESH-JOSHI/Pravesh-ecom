import { Response, NextFunction, Request } from "express";
import jwt from "jsonwebtoken";
import { User } from "@/modules/auth/auth.model";
import config from "@/config";
import { ApiError } from "@/interface";

export const auth = (...requiredRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token from header
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return next(new ApiError(400, "Authentication required. No token provided","AUTH_MIDDLEWARE"));
      }

      // Verify token
      const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };

      let user = await User.findById(decoded.userId)

      if (!user) {
        return next(new ApiError(401, "User not found","AUTH_MIDDLEWARE"));
      }

      // Attach user to request
      req.user = user;
      // Role-based authorization
      if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
        return next(new ApiError(403, "You do not have permission to perform this action","AUTH_MIDDLEWARE"));
      }

      next();
    } catch (error) {
      next(new ApiError(401, "Invalid or expired token","AUTH_MIDDLEWARE"));
    }
  };
};
