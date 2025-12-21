import { asyncHandler } from "@/utils";
import { RedisKeys } from "@/utils/redisKeys";
import { CacheTTL } from "@/utils/cacheTTL";
import { redis } from "@/config/redis";
import { AddressValidation } from "./address.validation";
import { Address } from "./address.model";
import status from "http-status";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import mongoose from "mongoose";
import { User } from "../user/user.model";
import { RedisPatterns } from '@/utils/redisKeys';
const ApiError = getApiErrorClass("ADDRESS");
const ApiResponse = getApiResponseClass("ADDRESS");


export const createAddress = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const validatedData = AddressValidation.parse(req.body);

  const address = await Address.create({
    ...validatedData,
    user: userId,
  })
  if (!address) {
    throw new ApiError(status.INTERNAL_SERVER_ERROR, "Failed to create address");
  }

  await redis.deleteByPattern(RedisPatterns.ADDRESSES_BY_USER(String(address.user)));
  await redis.deleteByPattern(RedisPatterns.ADDRESSES_ALL());
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(address.user)));

  res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Address created successfully", address));
  return;
})

export const getAddressById = asyncHandler(async (req, res) => {
  const { populate = 'false' } = req.query;
  const addressId = req.params.id;
  const cacheKey = RedisKeys.ADDRESS_BY_ID(addressId, req.query as Record<string, any>);
  const cacheValue = await redis.get(cacheKey);
  if (cacheValue) {
    res.status(status.OK).json(new ApiResponse(status.OK, "Address retrieved successfully", cacheValue));
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid address ID");
  }
  let address;
  if (populate == 'true') {
    address = await Address.findOne({
      _id: addressId,
      isDeleted: false,
    }).populate([
      {
        path: 'user',
        select: '_id name email'
      },
      {
        path: 'orders',
        options: {
          limit: 10,
          sort: { createdAt: -1 }
        }
      }
    ]);
  } else {
    address = await Address.findOne({
      _id: addressId,
      isDeleted: false,
    }).populate('user', 'name email');
  }
  if (!address) {
    throw new ApiError(status.NOT_FOUND, "Address not found or you are not authorized to access it");
  }
  const addressObj = (address as any)?.toObject ? (address as any).toObject() : address;
  await redis.set(cacheKey, addressObj, CacheTTL.LONG);
  res.status(status.OK).json(new ApiResponse(status.OK, "Address retrieved successfully", address));
  return;
})

export const updateMyAddress = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const addressId = req.params.id;
  const validatedData = AddressValidation.partial().parse(req.body);
  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid address ID");
  }
  const existingAddress = await Address.findOne({
    _id: addressId,
    user: userId,
    isDeleted: false,
  });
  if (!existingAddress) {
    throw new ApiError(status.NOT_FOUND, "Address not found or you are not authorized to update it");
  }
  const updatedAddress = await Address.findByIdAndUpdate(existingAddress._id, {
    ...validatedData,
  }, { new: true });

  await redis.deleteByPattern(RedisPatterns.ADDRESS_ANY(String(addressId)));
  await redis.deleteByPattern(RedisPatterns.ADDRESSES_BY_USER(String(userId)));
  await redis.deleteByPattern(RedisPatterns.ADDRESSES_ALL());
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));




  res.status(status.OK).json(new ApiResponse(status.OK, "Address updated successfully", updatedAddress));
  return;
})

export const deleteMyAddress = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const addressId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(addressId)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid address ID");
  }
  const existingAddress = await Address.findOne({
    _id: addressId,
    user: userId,
    isDeleted: false,
  });
  if (!existingAddress) {
    throw new ApiError(status.NOT_FOUND, "Address not found or you are not authorized to delete it");
  }
  existingAddress.isDeleted = true;
  await existingAddress.save();

  await redis.deleteByPattern(RedisPatterns.ADDRESS_ANY(String(addressId)));
  await redis.deleteByPattern(RedisPatterns.ADDRESSES_BY_USER(String(userId)));
  await redis.deleteByPattern(RedisPatterns.ADDRESSES_ALL());
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));




  res.status(status.OK).json(new ApiResponse(status.OK, "Address deleted successfully"));
})

export const getMyAddresses = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { page = 1, limit = 10 } = req.query;
  const cacheKey = RedisKeys.ADDRESSES_BY_USER(String(userId), req.query as Record<string, any>);
  const cachedAddresses = await redis.get(cacheKey);

  if (cachedAddresses) {
    return res.status(status.OK).json(new ApiResponse(status.OK, "Addresses retrieved successfully", cachedAddresses));
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [addresses, total] = await Promise.all([
    Address.find({ user: userId, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Address.countDocuments({ user: userId, isDeleted: false }),
  ]);
  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    addresses,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res.status(status.OK).json(new ApiResponse(status.OK, "Addresses retrieved successfully", result));
})

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { id } = req.params;
  const address = await Address.findOne({ _id: id, isDeleted: false });
  if (!address) {
    return res.status(status.NOT_FOUND).json(new ApiResponse(status.NOT_FOUND, "Address not found"));
  }
  if (address.user !== userId) {
    throw new ApiError(status.FORBIDDEN, "You are not authorized to set this address as default");
  }
  await Address.findOneAndUpdate(
    { user: userId, isDefault: true, isDeleted: false },
    { $set: { isDefault: false } }
  );
  address.isDefault = true;
  await address.save();
  await redis.deleteByPattern(RedisPatterns.ADDRESSES_BY_USER(String(userId)));
  await redis.deleteByPattern(RedisPatterns.ADDRESSES_ALL());
  await redis.deleteByPattern(RedisPatterns.USER_ANY(String(userId)));


  res.status(status.OK).json(new ApiResponse(status.OK, "Default address set successfully"));
  return;
})

export const getAllAddresses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, user, isDeleted } = req.query;

  const cacheKey = RedisKeys.ADDRESSES_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);

  if (cached)
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "All addresses retrieved successfully", cached));

  const filter: any = {};
  if (isDeleted !== undefined) filter.isDeleted = isDeleted === "true";
  else filter.isDeleted = false;

  if (user) {
    if (mongoose.Types.ObjectId.isValid(user as string)) {
      filter.user = user;
    } else {
      const userRegex = new RegExp(user as string, 'i');
      const users = await User.find({
        $or: [
          { name: { $regex: userRegex } },
          { email: { $regex: userRegex } },
          { phone: { $regex: userRegex } },
        ],
        isDeleted: false
      }, { _id: 1 });

      const userIds = users.map((u) => u._id);

      filter.user = userIds.length > 0 ? { $in: userIds } : new mongoose.Types.ObjectId(0);
    }
}

const skip = (Number(page) - 1) * Number(limit);

const pipeline: any[] = [];

if (search) {
    const searchRegex = new RegExp(search as string, 'i');

    const searchCriteria = {
      $or: [
        { fullname: { $regex: searchRegex } },
        { phone: { $regex: searchRegex } },
        { city: { $regex: searchRegex } },
        { state: { $regex: searchRegex } },
        { postalCode: { $regex: searchRegex } },
        { country: { $regex: searchRegex } },
      ]
    };

    const combinedMatch = {
      $and: [
        searchCriteria,
        filter
      ]
    };

    pipeline.push({ $match: combinedMatch });

} else {
    pipeline.push({ $match: filter });
}


pipeline.push({ $sort: { createdAt: -1 } });
pipeline.push({ $skip: skip });
pipeline.push({ $limit: Number(limit) });

  const addresses = await Address.aggregate(pipeline);
  const total = await Address.countDocuments(filter);
  const totalPages = Math.ceil(total / Number(limit));

  const result = {
    addresses,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "All addresses retrieved successfully", result));
});
