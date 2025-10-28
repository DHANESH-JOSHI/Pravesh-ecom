import { User } from "./user.model";
import { emailCheckValidation, phoneCheckValidation, updatePasswordValidation, updateUserValidation } from "./user.validation";
import { asyncHandler, generateCacheKey } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import status from "http-status";
import { redis } from "@/config/redis";
const ApiError = getApiErrorClass("USER");
const ApiResponse = getApiResponseClass("USER");

export const getMe = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const cacheKey = `user:${userId}`;
  const cachedUser = await redis.get(cacheKey);

  if (cachedUser) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "User profile retrieved successfully", cachedUser));
  }
  await redis.set(cacheKey, req.user, 600);
  res.status(status.OK).json(new ApiResponse(status.OK, "User profile retrieved successfully", req.user));
});

export const updateUser = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const validatedData = updateUserValidation.parse(req.body);

  if (validatedData.email && validatedData.email.length > 0) {
    const existingUser = await User.findOne({
      email: validatedData.email,
      _id: { $ne: userId }
    });

    if (existingUser) {
      throw new ApiError(status.BAD_REQUEST, "Email already exists");
    }
  }

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
  await redis.delete('dashboard:stats')

  res.json(new ApiResponse(status.OK, "User updated successfully", updatedUser));
  return;
});


export const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role, status: userStatus, isDeleted } = req.query;
  const cacheKey = generateCacheKey('users', req.query);
  const cachedUsers = await redis.get(cacheKey);

  if (cachedUsers) {
    return res.json(new ApiResponse(status.OK, "Users retrieved successfully", cachedUsers));
  }

  const filter: any = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }
  if (role) filter.role = role;
  if (userStatus) filter.status = userStatus;
  if (isDeleted !== undefined) {
    filter.isDeleted = isDeleted === 'true';
  } else {
    filter.isDeleted = false;
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    users,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
  };

  await redis.set(cacheKey, result, 600);

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

  await redis.set(cacheKey, user, 600);

  res.json(new ApiResponse(status.OK, "User retrieved successfully", user));
  return;
});

export const updatePassword = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, "User not authenticated");
  }
  const { currentPassword, newPassword } = updatePasswordValidation.parse(req.body);

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  const isPasswordCorrect = await user.comparePassword(currentPassword)
  if (!isPasswordCorrect) {
    throw new ApiError(status.UNAUTHORIZED, "Incorrect password");
  }
  user.password = newPassword;
  await user.save();

  res.json(new ApiResponse(status.OK, "Password reset successfully"));
  return;
});

export const recoverUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id)
  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (!user.isDeleted) {
    throw new ApiError(status.BAD_REQUEST, "User is already active");
  }

  user.isDeleted = false;
  await user.save();
  await redis.delete('dashboard:stats')

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

  await redis.delete('dashboard:stats')

  res.json(new ApiResponse(status.OK, "User deleted successfully"));
  return;
});

export const checkPhoneExists = asyncHandler(async (req, res) => {
  const { phone } = phoneCheckValidation.parse(req.params);

  const user = await User.findOne({ phone });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "Phone number not found");
  }

  res.json(new ApiResponse(status.OK, "Phone number exists", true));
  return;
});

export const checkEmailExists = asyncHandler(async (req, res) => {
  const { email } = emailCheckValidation.parse(req.params);

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "Email not found");
  }

  res.json(new ApiResponse(status.OK, "Email exists", true));
  return;
});

