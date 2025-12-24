import { asyncHandler } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { User } from '../user/user.model';
import { UserRole, UserStatus } from '../user/user.interface';
import { createStaffValidation, updateStaffValidation } from './admin.validation';
import status from 'http-status';
import { redis } from "@/config/redis";
import { RedisPatterns } from "@/utils/redisKeys";

const ApiError = getApiErrorClass("ADMIN");
const ApiResponse = getApiResponseClass("ADMIN");

export const createStaff = asyncHandler(async (req, res) => {
  const data = createStaffValidation.parse(req.body);
  const currentAdmin = req.user;

  // Only admin can create staff
  if (currentAdmin?.role !== UserRole.ADMIN) {
    throw new ApiError(status.FORBIDDEN, 'Only admin can create staff');
  }

  // Check if phone or email already exists
  const existingUser = await User.findOne({
    $or: [
      { phone: data.phone },
      ...(data.email ? [{ email: data.email }] : [])
    ],
    isDeleted: false
  });

  if (existingUser) {
    throw new ApiError(status.BAD_REQUEST, 'User with this phone or email already exists');
  }

  const staff = await User.create({
    ...data,
    role: UserRole.STAFF,
    status: UserStatus.PENDING,
  });

  const { password, otp, otpExpires, ...staffObject } = staff.toJSON();

  // Invalidate user caches
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(staff._id)));
  await redis.deleteByPattern(RedisPatterns.USERS_ALL());

  res.status(status.CREATED).json(
    new ApiResponse(status.CREATED, 'Staff admin created successfully', staffObject)
  );
});

export const getAllStaff = asyncHandler(async (req, res) => {
  const currentAdmin = req.user;

  // Only admin can view all staff
  if (currentAdmin?.role !== UserRole.ADMIN) {
    throw new ApiError(status.FORBIDDEN, 'Only admin can view all staff');
  }

  const staff = await User.find({
    role: UserRole.STAFF,
    isDeleted: false
  }).select('-password -otp -otpExpires').sort({ createdAt: -1 });

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Staff list retrieved successfully', staff)
  );
});

export const updateStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = updateStaffValidation.parse(req.body);
  const currentAdmin = req.user;

  // Only admin can update staff
  if (currentAdmin?.role !== UserRole.ADMIN) {
    throw new ApiError(status.FORBIDDEN, 'Only admin can update staff');
  }

  const staff = await User.findOne({ _id: id, role: UserRole.STAFF, isDeleted: false });
  if (!staff) {
    throw new ApiError(status.NOT_FOUND, 'Staff not found');
  }

  if (data.phone) {
    const existingUser = await User.findOne({
      phone: data.phone,
      _id: { $ne: id },
      isDeleted: false
    });
    if (existingUser) {
      throw new ApiError(status.BAD_REQUEST, 'Phone number already in use');
    }
  }

  if (data.email) {
    const existingUser = await User.findOne({
      email: data.email,
      _id: { $ne: id },
      isDeleted: false
    });
    if (existingUser) {
      throw new ApiError(status.BAD_REQUEST, 'Email already in use');
    }
  }

  Object.assign(staff, data);
  await staff.save();

  const { password, otp, otpExpires, ...staffObject } = staff.toJSON();

  // Invalidate user caches
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(staff._id)));
  await redis.deleteByPattern(RedisPatterns.USERS_ALL());

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Staff updated successfully', staffObject)
  );
});

export const deleteStaff = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentAdmin = req.user;

  // Only admin can delete staff
  if (currentAdmin?.role !== UserRole.ADMIN) {
    throw new ApiError(status.FORBIDDEN, 'Only admin can delete staff');
  }

  const staff = await User.findOne({ _id: id, role: UserRole.STAFF, isDeleted: false });
  if (!staff) {
    throw new ApiError(status.NOT_FOUND, 'Staff not found');
  }

  staff.isDeleted = true;
  await staff.save();

  // Invalidate user caches
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(staff._id)));
  await redis.deleteByPattern(RedisPatterns.USERS_ALL());

  res.status(status.OK).json(
    new ApiResponse(status.OK, 'Staff deleted successfully')
  );
});

