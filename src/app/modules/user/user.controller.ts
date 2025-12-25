import { User } from "./user.model";
import { emailCheckValidation, phoneCheckValidation, resetPasswordValidation, updatePasswordValidation, updateUserValidation } from "./user.validation";
import { asyncHandler } from "@/utils";
import { RedisKeys } from "@/utils/redisKeys";
import { CacheTTL } from "@/utils/cacheTTL";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import status from "http-status";
import { redis } from "@/config/redis";
import mongoose from "mongoose";
import { UserRole, UserStatus } from "./user.interface";
import { registerValidation } from "../auth/auth.validation";
import { cloudinary } from "@/config/cloudinary";
import { RedisPatterns } from "@/utils/redisKeys";
import { logger } from "@/config/logger";
const ApiError = getApiErrorClass("USER");
const ApiResponse = getApiResponseClass("USER");

export const createUser = asyncHandler(async (req, res) => {
  const { name, password, phone, email, role } = registerValidation.parse(req.body);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let user = await User.findOne({ $or: [{ phone }, { email }], isDeleted: false }).session(session);
    if (user) {
      throw new ApiError(status.BAD_REQUEST, "User already exists with this phone or email.");
    }
    user = new User({
      name,
      password,
      phone,
      email,
      role: role || UserRole.USER,
      status: UserStatus.ACTIVE
    });

    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Invalidate all user lists (new user added to lists)
    await redis.deleteByPattern(RedisPatterns.USERS_ALL());
    // Invalidate dashboard stats (user count changed)
    await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());

    const { password: _, otp: __, otpExpires: ___, ...userObject } = user.toJSON();

    res
      .status(status.CREATED)
      .json(
        new ApiResponse(
          status.CREATED,
          `User created and verified successfully.`,
          userObject
        )
      );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
})

export const getMe = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const cacheKey = RedisKeys.USER_BY_ID(String(userId));
  const cachedUser = await redis.get(cacheKey);

  if (cachedUser) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "User profile retrieved successfully", cachedUser));
  }

  const user = await User.findOne({ _id: userId, isDeleted: false }, { password: 0, otp: 0, otpExpires: 0 });
  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  const userObj = (user as any)?.toObject ? (user as any).toObject() : user;
  await redis.set(cacheKey, userObj, CacheTTL.MEDIUM);
  res.status(status.OK).json(new ApiResponse(status.OK, "User profile retrieved successfully", user));
  return;
});

export const updateUser = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  
  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, "User not authenticated");
  }

  // Handle empty email string - convert undefined/null to empty string for validation
  if (req.body.email === undefined || req.body.email === null) {
    req.body.email = '';
  }
  
  const validatedData = updateUserValidation.parse(req.body);
  const user = await User.findOne({ _id: userId, isDeleted: false });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  
  if (validatedData.email && validatedData.email.length > 0) {
    const existingUser = await User.findOne({
      email: validatedData.email,
      _id: { $ne: userId },
      isDeleted: false
    });

    if (existingUser) {
      throw new ApiError(status.BAD_REQUEST, "Email already exists");
    }
  }

  if (validatedData.email === '') {
    delete validatedData.email;
  }

  if (req.file) {
    // CloudinaryStorage stores the URL in req.file.path (same as other controllers)
    validatedData.img = req.file.path;
    // Delete old image if it exists
    if (user.img) {
      try {
        const publicId = user.img.split("/").pop()?.split(".")[0];
        if (publicId) {
          await cloudinary.uploader.destroy(`pravesh-users/${publicId}`);
        }
      } catch (error) {
        logger.error("Error deleting old image:", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    validatedData,
    { new: true, select: '-password -otp -otpExpires' }
  );

  if (!updatedUser) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  // Invalidate this user's cache (user data changed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));
  // Invalidate all user lists (user data changed in lists)
  await redis.deleteByPattern(RedisPatterns.USERS_ALL());
  // Invalidate dashboard stats (user data might affect stats)
  await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());
  // Invalidate reviews by this user (reviews display user name, email, img)
  await redis.deleteByPattern(RedisPatterns.REVIEWS_BY_USER(String(userId)));
  // Invalidate all review lists (review lists might show user info)
  await redis.deleteByPattern(RedisPatterns.REVIEWS_ALL());
  // Invalidate orders by this user (orders display user info)
  await redis.deleteByPattern(RedisPatterns.ORDERS_BY_USER(String(userId)));
  // Invalidate all order lists (order lists might show user info)
  await redis.deleteByPattern(RedisPatterns.ORDERS_ALL());
  // Invalidate this user's cart (cart belongs to user)
  await redis.deleteByPattern(RedisPatterns.CART_BY_USER_ANY(String(userId)));
  // Invalidate this user's cart summary (cart summary belongs to user)
  await redis.delete(RedisKeys.CART_SUMMARY_BY_USER(String(userId)));
  // Invalidate all cart lists (carts display user info: name, email)
  await redis.deleteByPattern(RedisPatterns.CARTS_ALL());
  // Invalidate all individual cart caches (carts display user info: name, email)
  await redis.deleteByPattern(RedisPatterns.CARTS_INDIVIDUAL());
  // Invalidate addresses by this user (addresses belong to user)
  await redis.deleteByPattern(RedisPatterns.ADDRESSES_BY_USER(String(userId)));

  res.json(new ApiResponse(status.OK, "User updated successfully", updatedUser));
  return;
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role, status: userStatus, isDeleted } = req.query;

  const cacheKey = RedisKeys.USERS_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);

  if (cached)
    return res.json(new ApiResponse(status.OK, "Users retrieved successfully", cached));

  const filter: any = {};
  if (role) filter.role = role;
  if (userStatus) filter.status = userStatus;
  if (isDeleted !== undefined) filter.isDeleted = isDeleted === "true";
  else filter.isDeleted = false;

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');

    const searchCriteria = {
      $or: [
        { name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
        { phone: { $regex: searchRegex } }
      ]
    };

    pipeline.push({ $match: searchCriteria });
  }

  pipeline.push({ $match: { role: { $ne: UserRole.ADMIN }, ...filter } });
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  pipeline.push({
    $project: {
      password: 0,
      otp: 0,
      otpExpires: 0
    }
  });

  const users = await User.aggregate(pipeline);
  const total = await User.countDocuments(filter);
  const totalPages = Math.ceil(total / Number(limit));

  const result = {
    users,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res.json(new ApiResponse(status.OK, "Users retrieved successfully", result));
});

export const getUserById = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { populate = 'false' } = req.query;
  const cacheKey = RedisKeys.USER_BY_ID(userId, req.query as Record<string, any>);
  const cachedUser = await redis.get(cacheKey);

  if (cachedUser) {
    return res.json(new ApiResponse(status.OK, "User retrieved successfully", cachedUser));
  }
  let user;
  if (populate == 'true') {
    user = await User.findOne({ _id: userId }, { password: 0 }).populate([
      {
        path: 'reviews',
        select: '_id rating comment createdAt',
        populate: {
          path: 'product',
          select: 'name',
          match: { isDeleted: false }
        },
        options: { limit: 5, sort: { createdAt: -1 } },
      },
      {
        path: 'addresses',
        select: '_id fullname phone line1 line2 landmark city state postalCode country',
        options: { limit: 5 },
      },
      {
        path: 'orders',
        select: '_id status createdAt updatedAt orderNumber',
        options: { limit: 5, sort: { createdAt: -1 } },
      },
      {
        path: 'cart',
        select: '_id',
      },
      {
        path: 'wishlist',
        select: '_id',
      },
    ]);
  } else {
    user = await User.findOne({ _id: userId }, { password: 0, otp: 0, otpExpires: 0 });
  }

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  const userObjDetail = (user as any)?.toObject ? (user as any).toObject() : user;
  await redis.set(cacheKey, userObjDetail, CacheTTL.LONG);

  res.json(new ApiResponse(status.OK, "User retrieved successfully", user));
  return;
});

export const updatePassword = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { currentPassword, newPassword } = updatePasswordValidation.parse(req.body);

  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  const isPasswordCorrect = await user.comparePassword(currentPassword)
  if (!isPasswordCorrect) {
    throw new ApiError(status.BAD_REQUEST, "Incorrect password");
  }
  user.password = newPassword;
  await user.save();

  res.json(new ApiResponse(status.OK, "Password updated successfully"));
  return;
});

export const recoverUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findOne({ _id: id, isDeleted: false })
  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (!user.isDeleted) {
    throw new ApiError(status.BAD_REQUEST, "User is already active");
  }

  user.isDeleted = false;
  await user.save();

  // Invalidate this user's cache (user recovered, isDeleted changed)
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(id)));
  // Invalidate all user lists (user recovered, affects user lists)
  await redis.deleteByPattern(RedisPatterns.USERS_ALL());
  // Invalidate dashboard stats (user count changed)
  await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());

  res.json(new ApiResponse(status.OK, "User recovered successfully"));
  return;
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findOne({ _id: id, isDeleted: false });
  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  user.isDeleted = true;
  await user.save();

  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(id)));
  await redis.deleteByPattern(RedisPatterns.USERS_ALL());
  await redis.deleteByPattern(RedisPatterns.DASHBOARD_ALL());

  res.json(new ApiResponse(status.OK, "User deleted successfully"));
  return;
});

export const checkPhoneExists = asyncHandler(async (req, res) => {
  const { phone } = phoneCheckValidation.parse(req.params);
  const cacheKey = `user:phone:${phone}`;
  const cachedResult = await redis.get(cacheKey);

  if (cachedResult !== null) {
    return res.json(new ApiResponse(status.OK, "Phone number exists", cachedResult));
  }

  const user = await User.findOne({ phone, isDeleted: false });

  const exists = !!user;
  await redis.set(cacheKey, exists, CacheTTL.SHORT);

  if (!exists) {
    throw new ApiError(status.NOT_FOUND, "Phone number not found");
  }

  res.json(new ApiResponse(status.OK, "Phone number exists", true));
  return;
});

export const checkEmailExists = asyncHandler(async (req, res) => {
  const { email } = emailCheckValidation.parse(req.params);
  const cacheKey = `user:email:${email}`;
  const cachedResult = await redis.get(cacheKey);

  if (cachedResult !== null) {
    return res.json(new ApiResponse(status.OK, "Email exists", cachedResult));
  }

  const user = await User.findOne({ email, isDeleted: false });

  const exists = !!user;
  await redis.set(cacheKey, exists, CacheTTL.SHORT);

  if (!exists) {
    throw new ApiError(status.NOT_FOUND, "Email not found");
  }

  res.json(new ApiResponse(status.OK, "Email exists", true));
  return;
});

export const resetPassword = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { otp, newPassword } = resetPasswordValidation.parse(req.body)
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  if (!user.compareOtp(otp)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid or expired OTP");
  }
  user.password = newPassword;
  await user.save();
  res.json(new ApiResponse(status.OK, "Password reset successfully"));
  return;
})
