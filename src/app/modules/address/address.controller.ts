import { asyncHandler, generateCacheKey } from "@/utils";
import { redis } from "@/config/redis";
import { AddressValidation } from "./address.validation";
import { Address } from "./address.model";
import status from "http-status";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import mongoose from "mongoose";
import { User } from "../user/user.model";
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

  await redis.deleteByPattern(`addresses:user:${address.user}*`);
  await redis.deleteByPattern('addresses:all*');
  await redis.deleteByPattern(`users:${address.user}?populate=true`);

  res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Address created successfully", address));
  return;
})

export const getAddressById = asyncHandler(async (req, res) => {
  const { populate = 'false' } = req.query;
  const addressId = req.params.id;
  const cacheKey = generateCacheKey(`address:${addressId}`, req.query)
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
  await redis.set(cacheKey, address, 600);
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

  await redis.deleteByPattern(`address:${addressId}*`);
  await redis.deleteByPattern(`addresses:user:${userId}*`);
  await redis.delete(`users:${userId}?populate=true`);
  await redis.deleteByPattern('addresses:all*');

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

  await redis.deleteByPattern(`address:${addressId}*`);
  await redis.deleteByPattern(`addresses:user:${userId}*`);
  await redis.delete(`users:${userId}?populate=true`);
  await redis.deleteByPattern('addresses:all*');

  res.status(status.OK).json(new ApiResponse(status.OK, "Address deleted successfully"));
})

export const getMyAddresses = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { page = 1, limit = 10 } = req.query;
  const cacheKey = generateCacheKey(`addresses:user:${userId}`, req.query);
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

  await redis.set(cacheKey, result, 600);

  res.status(status.OK).json(new ApiResponse(status.OK, "Addresses retrieved successfully", result));
})

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { id } = req.params;
  const address = await Address.findById(id);
  if (!address) {
    return res.status(status.NOT_FOUND).json(new ApiResponse(status.NOT_FOUND, "Address not found"));
  }
  if (address.user !== userId) {
    throw new ApiError(status.FORBIDDEN, "You are not authorized to set this address as default");
  }
  await Address.findOneAndUpdate(
    { user: userId, isDefault: true },
    { $set: { isDefault: false } }
  );
  address.isDefault = true;
  await address.save();
  await redis.deleteByPattern(`addresses:user:${userId}*`);
  await redis.delete(`users:${userId}?populate=true`);
  await redis.deleteByPattern(`address:${id}*`);
  res.status(status.OK).json(new ApiResponse(status.OK, "Default address set successfully"));
  return;
})

export const getAllAddresses = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, user, isDeleted } = req.query;

  const cacheKey = generateCacheKey("addresses:all", req.query);
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
      const users = await User.aggregate([
        {
          $search: {
            index: "autocomplete_index",
            autocomplete: {
              query: user,
              path: ["name", "email", "phone"],
              fuzzy: { maxEdits: 1 }
            }
          }
        },
        { $project: { _id: 1 } }
      ]);

      const userIds = users.map((u) => u._id);
      filter.user = { $in: userIds };
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline: any[] = [];

  if (search) {
    pipeline.push({
      $search: {
        index: "autocomplete_index",
        autocomplete: {
          query: search,
          path: ["fullname", "phone", "city", "state", "postalCode", "country"],
          fuzzy: { maxEdits: 1 }
        }
      }
    });
  }

  pipeline.push({ $match: filter });
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

  await redis.set(cacheKey, result, 600);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "All addresses retrieved successfully", result));
});
