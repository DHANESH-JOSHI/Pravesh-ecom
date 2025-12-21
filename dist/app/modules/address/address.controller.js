"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllAddresses = exports.setDefaultAddress = exports.getMyAddresses = exports.deleteMyAddress = exports.updateMyAddress = exports.getAddressById = exports.createAddress = void 0;
const utils_1 = require("../../utils");
const redisKeys_1 = require("../../utils/redisKeys");
const cacheTTL_1 = require("../../utils/cacheTTL");
const redis_1 = require("../../config/redis");
const address_validation_1 = require("./address.validation");
const address_model_1 = require("./address.model");
const http_status_1 = __importDefault(require("http-status"));
const interface_1 = require("../../interface");
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../user/user.model");
const invalidateCache_1 = require("../../utils/invalidateCache");
const ApiError = (0, interface_1.getApiErrorClass)("ADDRESS");
const ApiResponse = (0, interface_1.getApiResponseClass)("ADDRESS");
exports.createAddress = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const validatedData = address_validation_1.AddressValidation.parse(req.body);
    const address = await address_model_1.Address.create({
        ...validatedData,
        user: userId,
    });
    if (!address) {
        throw new ApiError(http_status_1.default.INTERNAL_SERVER_ERROR, "Failed to create address");
    }
    await (0, invalidateCache_1.invalidateAddressCaches)({ userId: String(address.user) });
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, "Address created successfully", address));
    return;
});
exports.getAddressById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { populate = 'false' } = req.query;
    const addressId = req.params.id;
    const cacheKey = redisKeys_1.RedisKeys.ADDRESS_BY_ID(addressId, req.query);
    const cacheValue = await redis_1.redis.get(cacheKey);
    if (cacheValue) {
        res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Address retrieved successfully", cacheValue));
        return;
    }
    if (!mongoose_1.default.Types.ObjectId.isValid(addressId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid address ID");
    }
    let address;
    if (populate == 'true') {
        address = await address_model_1.Address.findOne({
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
    }
    else {
        address = await address_model_1.Address.findOne({
            _id: addressId,
            isDeleted: false,
        }).populate('user', 'name email');
    }
    if (!address) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Address not found or you are not authorized to access it");
    }
    const addressObj = address?.toObject ? address.toObject() : address;
    await redis_1.redis.set(cacheKey, addressObj, cacheTTL_1.CacheTTL.LONG);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Address retrieved successfully", address));
    return;
});
exports.updateMyAddress = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const addressId = req.params.id;
    const validatedData = address_validation_1.AddressValidation.partial().parse(req.body);
    if (!mongoose_1.default.Types.ObjectId.isValid(addressId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid address ID");
    }
    const existingAddress = await address_model_1.Address.findOne({
        _id: addressId,
        user: userId,
        isDeleted: false,
    });
    if (!existingAddress) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Address not found or you are not authorized to update it");
    }
    const updatedAddress = await address_model_1.Address.findByIdAndUpdate(existingAddress._id, {
        ...validatedData,
    }, { new: true });
    await (0, invalidateCache_1.invalidateAddressCaches)({ addressId: String(addressId), userId: String(userId) });
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Address updated successfully", updatedAddress));
    return;
});
exports.deleteMyAddress = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const addressId = req.params.id;
    if (!mongoose_1.default.Types.ObjectId.isValid(addressId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid address ID");
    }
    const existingAddress = await address_model_1.Address.findOne({
        _id: addressId,
        user: userId,
        isDeleted: false,
    });
    if (!existingAddress) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Address not found or you are not authorized to delete it");
    }
    existingAddress.isDeleted = true;
    await existingAddress.save();
    await (0, invalidateCache_1.invalidateAddressCaches)({ addressId: String(addressId), userId: String(userId) });
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Address deleted successfully"));
});
exports.getMyAddresses = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { page = 1, limit = 10 } = req.query;
    const cacheKey = redisKeys_1.RedisKeys.ADDRESSES_BY_USER(String(userId), req.query);
    const cachedAddresses = await redis_1.redis.get(cacheKey);
    if (cachedAddresses) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Addresses retrieved successfully", cachedAddresses));
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [addresses, total] = await Promise.all([
        address_model_1.Address.find({ user: userId, isDeleted: false })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        address_model_1.Address.countDocuments({ user: userId, isDeleted: false }),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        addresses,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, cacheTTL_1.CacheTTL.SHORT);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Addresses retrieved successfully", result));
});
exports.setDefaultAddress = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { id } = req.params;
    const address = await address_model_1.Address.findOne({ _id: id, isDeleted: false });
    if (!address) {
        return res.status(http_status_1.default.NOT_FOUND).json(new ApiResponse(http_status_1.default.NOT_FOUND, "Address not found"));
    }
    if (address.user !== userId) {
        throw new ApiError(http_status_1.default.FORBIDDEN, "You are not authorized to set this address as default");
    }
    await address_model_1.Address.findOneAndUpdate({ user: userId, isDefault: true, isDeleted: false }, { $set: { isDefault: false } });
    address.isDefault = true;
    await address.save();
    await (0, invalidateCache_1.invalidateAddressCaches)({ userId: String(userId) });
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Default address set successfully"));
    return;
});
exports.getAllAddresses = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, search, user, isDeleted } = req.query;
    const cacheKey = redisKeys_1.RedisKeys.ADDRESSES_LIST(req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res
            .status(http_status_1.default.OK)
            .json(new ApiResponse(http_status_1.default.OK, "All addresses retrieved successfully", cached));
    const filter = {};
    if (isDeleted !== undefined)
        filter.isDeleted = isDeleted === "true";
    else
        filter.isDeleted = false;
    if (user) {
        if (mongoose_1.default.Types.ObjectId.isValid(user)) {
            filter.user = user;
        }
        else {
            const userRegex = new RegExp(user, 'i');
            const users = await user_model_1.User.find({
                $or: [
                    { name: { $regex: userRegex } },
                    { email: { $regex: userRegex } },
                    { phone: { $regex: userRegex } },
                ],
                isDeleted: false
            }, { _id: 1 });
            const userIds = users.map((u) => u._id);
            filter.user = userIds.length > 0 ? { $in: userIds } : new mongoose_1.default.Types.ObjectId(0);
        }
    }
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline = [];
    if (search) {
        const searchRegex = new RegExp(search, 'i');
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
    }
    else {
        pipeline.push({ $match: filter });
    }
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: Number(limit) });
    const addresses = await address_model_1.Address.aggregate(pipeline);
    const total = await address_model_1.Address.countDocuments(filter);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        addresses,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, cacheTTL_1.CacheTTL.SHORT);
    res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "All addresses retrieved successfully", result));
});
//# sourceMappingURL=address.controller.js.map