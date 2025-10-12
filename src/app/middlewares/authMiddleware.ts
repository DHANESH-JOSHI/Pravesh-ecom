import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "@/modules/auth/auth.model";
import { appError } from "@/errors";
import { userInterface } from "@/interface"
export const auth = (...requiredRoles: string[]) => {
  return async (req: userInterface, res: Response, next: NextFunction) => {
    try {
      // Get token from header
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return next(new appError("Authentication required. No token provided", 401));
      }


      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };

      // Find user across different collections
      let user: any = await User.findById(decoded.userId)
      // await Staff.findById(decoded.userId) || 
      // await AdminStaff.findById(decoded.userId);

      if (!user) {
        return next(new appError("User not found", 401));
      }

      // Attach user to request
      req.user = user;

      // Role-based authorization
      if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
        return next(new appError("You do not have permission to perform this action", 403));
      }

      next();
    } catch (error) {
      next(new appError("Invalid or expired token", 401));
    }
  };
};
