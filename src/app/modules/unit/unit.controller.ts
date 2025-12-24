import { redis } from "@/config/redis";
import { Unit } from "./unit.model";
import { createUnitValidation, updateUnitValidation } from "./unit.validation";
import { asyncHandler } from "@/utils";
import { RedisKeys } from "@/utils/redisKeys";
import { RedisPatterns } from '@/utils/redisKeys';
import { CacheTTL } from "@/utils/cacheTTL";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import mongoose from "mongoose";
import status from "http-status";
import { Product } from "../product/product.model";

const ApiError = getApiErrorClass("UNIT");
const ApiResponse = getApiResponseClass("UNIT");

export const createUnit = asyncHandler(async (req, res) => {
  const { name } = createUnitValidation.parse(req.body);

  // Check if unit with same name exists (case-insensitive)
  const existingUnit = await Unit.findOne({ 
    name: { $regex: new RegExp(`^${name}$`, 'i') },
    isDeleted: false 
  });

  if (existingUnit) {
    throw new ApiError(status.BAD_REQUEST, "Unit with this name already exists");
  }

  // Check if deleted unit exists with same name
  const deletedUnit = await Unit.findOne({ 
    name: { $regex: new RegExp(`^${name}$`, 'i') },
    isDeleted: true 
  });

  let unit;
  if (deletedUnit) {
    deletedUnit.isDeleted = false;
    deletedUnit.name = name;
    await deletedUnit.save();
    unit = deletedUnit;
  } else {
    unit = await Unit.create({ name });
  }

  // Invalidate all unit lists (new unit added)
  await redis.deleteByPattern(RedisPatterns.UNITS_ALL());
  // Invalidate this unit's cache by ID (new unit created)
  await redis.deleteByPattern(RedisPatterns.UNIT_ANY(String(unit._id)));

  res
    .status(status.CREATED)
    .json(new ApiResponse(status.CREATED, "Unit created successfully", unit));
});

export const getAllUnits = asyncHandler(async (req, res) => {
  const cacheKey = RedisKeys.UNITS_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);
  if (cached)
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Units retrieved successfully", cached));

  const {
    page = 1,
    limit = 100,
    search,
    isDeleted = "false",
  } = req.query;

  const filter: any = { isDeleted: isDeleted === "true" };

  if (search) {
    const searchRegex = new RegExp(search as string, 'i');
    filter.name = { $regex: searchRegex };
  }

  const sortOrder = -1;
  const skip = (Number(page) - 1) * Number(limit);

  const units = await Unit.find(filter)
    .sort({ createdAt: sortOrder })
    .skip(skip)
    .limit(Number(limit));

  const total = await Unit.countDocuments(filter);
  const totalPages = Math.ceil(total / Number(limit));

  const result = { units, total, page: Number(page), totalPages };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Units retrieved successfully", result));
});

export const getUnitById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(status.BAD_REQUEST, "Invalid unit ID");

  const cacheKey = RedisKeys.UNIT_BY_ID(id);
  const cached = await redis.get(cacheKey);
  if (cached)
    return res.status(status.OK).json(new ApiResponse(status.OK, "Unit retrieved", cached));

  const unit = await Unit.findById(id);
  if (!unit) throw new ApiError(status.NOT_FOUND, "Unit not found");

  const unitObj = (unit as any)?.toObject ? (unit as any).toObject() : unit;
  await redis.set(cacheKey, unitObj, CacheTTL.LONG);
  res.status(status.OK).json(new ApiResponse(status.OK, "Unit retrieved successfully", unitObj));
});

export const updateUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = updateUnitValidation.parse(req.body);
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(status.BAD_REQUEST, "Invalid unit ID");

  const unit = await Unit.findOne({ _id: id, isDeleted: false });
  if (!unit) throw new ApiError(status.NOT_FOUND, "Unit not found");

  if (name && name !== unit.name) {
    const exists = await Unit.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: id },
      isDeleted: false 
    });
    if (exists) throw new ApiError(status.BAD_REQUEST, "Unit name already exists");
  }

  if (name) unit.name = name;
  await unit.save();

  // Invalidate this unit's cache by ID (unit data changed)
  await redis.deleteByPattern(RedisPatterns.UNIT_ANY(String(id)));
  // Invalidate all unit lists (unit data changed in lists)
  await redis.deleteByPattern(RedisPatterns.UNITS_ALL());
  // Invalidate all product lists (products display unit info)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());
  // Invalidate all individual product caches (products display unit info)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_INDIVIDUAL());

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Unit updated successfully", unit));
});

export const deleteUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ApiError(status.BAD_REQUEST, "Invalid unit ID");

  const unit = await Unit.findOne({ _id: id, isDeleted: false });
  if (!unit) throw new ApiError(status.NOT_FOUND, "Unit not found");

  // Check if unit is used in any products
  const productsUsingUnit = await Product.countDocuments({
    units: id,
    isDeleted: false
  });

  if (productsUsingUnit > 0) {
    throw new ApiError(
      status.BAD_REQUEST,
      `Cannot delete unit. It is used in ${productsUsingUnit} product(s)`
    );
  }

  unit.isDeleted = true;
  await unit.save();

  // Invalidate this unit's cache by ID (unit deleted)
  await redis.deleteByPattern(RedisPatterns.UNIT_ANY(String(id)));
  // Invalidate all unit lists (unit deleted from lists)
  await redis.deleteByPattern(RedisPatterns.UNITS_ALL());
  // Invalidate all product lists (products might reference this unit)
  await redis.deleteByPattern(RedisPatterns.PRODUCTS_ALL());

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Unit deleted successfully", unit));
});

