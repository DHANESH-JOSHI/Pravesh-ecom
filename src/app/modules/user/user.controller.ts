import { User } from "./user.model";
import { activateUserValidation, emailCheckValidation, phoneCheckValidation, resetPasswordValidation, updateUserValidation } from "./user.validation";
import { asyncHandler, generateCacheKey } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import { logger } from "@/config/logger";
import status from "http-status";
import { redis } from "@/config/redis";
import { UserStatus } from "./user.interface";
const ApiError = getApiErrorClass("USER");
const ApiResponse = getApiResponseClass("USER");

// get logged in user profile
export const getMe = asyncHandler(async (req, res) => {
  logger.info('Fetching logged in user profile');
  res.status(status.OK).json(new ApiResponse(status.OK, "User profile retrieved successfully", req.user));
});

export const updateUser = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  // Validate the clean data
  const validatedData = updateUserValidation.parse(req.body);

  // Check if email is being updated with a non-empty value and if it already exists
  if (validatedData.email && validatedData.email.length > 0) {
    const existingUser = await User.findOne({
      email: validatedData.email,
      _id: { $ne: userId }
    });

    if (existingUser) {
      throw new ApiError(status.BAD_REQUEST, "Email already exists");
    }
  }

  // If email is empty string, remove it from update data
  if (validatedData.email === '') {
    delete validatedData.email;
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    validatedData,
    { new: true, select: '-password' }
  );

  if (!updatedUser) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  await redis.deleteByPattern('users*');
  await redis.delete(`user:${userId}`);

  res.json(new ApiResponse(status.OK, "User updated successfully", updatedUser));
  return;
});


export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const cacheKey = generateCacheKey('users', req.query);
  const cachedUsers = await redis.get(cacheKey);

  if (cachedUsers) {
    return res.json(new ApiResponse(status.OK, "Users retrieved successfully", cachedUsers));
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find({}, { password: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(),
  ]);

  if (users.length === 0) {
    throw new ApiError(status.NOT_FOUND, "No users found");
  }

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    users,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result);

  res.json(new ApiResponse(status.OK, "Users retrieved successfully", result));
  return;
});

export const getUserById = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const cacheKey = `user:${userId}`;
  const cachedUser = await redis.get(cacheKey);

  if (cachedUser) {
    return res.json(new ApiResponse(status.OK, "User retrieved successfully", cachedUser));
  }

  if (!userId) {
    throw new ApiError(status.BAD_REQUEST, "User ID is required");
  }
  const user = await User.findById(userId, { password: 0 });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  await redis.set(cacheKey, user);

  res.json(new ApiResponse(status.OK, "User retrieved successfully", user));
  return;
});

export const resetPassword = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, "User not authenticated");
  }
  const { newPassword } = resetPasswordValidation.parse(req.body);

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  user.password = newPassword;
  await user.save();

  res.json(new ApiResponse(status.OK, "Password reset successfully"));
  return;
});

export const activateUser = asyncHandler(async (req, res) => {
  const { phone } = activateUserValidation.parse(req.body);

  const user = await User.findOne({ phone });
  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (user.status !== UserStatus.PENDING) {
    throw new ApiError(status.BAD_REQUEST, "User is already active");
  }

  user.status = UserStatus.ACTIVE;
  await user.save();

  res.json(new ApiResponse(status.OK, "User activated successfully"));
  return;
});

export const checkPhoneExists = asyncHandler(async (req, res) => {
  const { phone } = phoneCheckValidation.parse(req.params);

  const user = await User.findOne({ phone });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "Phone number not found");
  }

  res.json(new ApiResponse(status.OK, "Phone number exists", { exists: true, phone: user.phone }));
  return;
});

export const checkEmailExists = asyncHandler(async (req, res) => {
  const { email } = emailCheckValidation.parse(req.params);

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "Email not found");
  }

  res.json(new ApiResponse(status.OK, "Email exists", { exists: true, email: user.email }));
  return;
});
