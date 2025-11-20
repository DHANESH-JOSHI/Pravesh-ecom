"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllAddresses = exports.setDefaultAddress = exports.getMyAddresses = exports.deleteMyAddress = exports.updateMyAddress = exports.getAddressById = exports.createAddress = void 0;
const utils_1 = require("../../utils");
const redis_1 = require("../../config/redis");
const address_validation_1 = require("./address.validation");
const address_model_1 = require("./address.model");
const http_status_1 = __importDefault(require("http-status"));
const interface_1 = require("../../interface");
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../user/user.model");
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
    await redis_1.redis.deleteByPattern(`addresses:user:${address.user}*`);
    await redis_1.redis.deleteByPattern('addresses:all*');
    await redis_1.redis.deleteByPattern(`users:${address.user}?populate=true`);
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, "Address created successfully", address));
    return;
});
exports.getAddressById = (0, utils_1.asyncHandler)(async (req, res) => {
    const { populate = 'false' } = req.query;
    const addressId = req.params.id;
    const cacheKey = (0, utils_1.generateCacheKey)(`address:${addressId}`, req.query);
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
    await redis_1.redis.set(cacheKey, address, 600);
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
    await redis_1.redis.deleteByPattern(`address:${addressId}*`);
    await redis_1.redis.deleteByPattern(`addresses:user:${userId}*`);
    await redis_1.redis.delete(`users:${userId}?populate=true`);
    await redis_1.redis.deleteByPattern('addresses:all*');
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
    await redis_1.redis.deleteByPattern(`address:${addressId}*`);
    await redis_1.redis.deleteByPattern(`addresses:user:${userId}*`);
    await redis_1.redis.delete(`users:${userId}?populate=true`);
    await redis_1.redis.deleteByPattern('addresses:all*');
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Address deleted successfully"));
});
exports.getMyAddresses = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { page = 1, limit = 10 } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)(`addresses:user:${userId}`, req.query);
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
    await redis_1.redis.set(cacheKey, result, 600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Addresses retrieved successfully", result));
});
exports.setDefaultAddress = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { id } = req.params;
    const address = await address_model_1.Address.findById(id);
    if (!address) {
        return res.status(http_status_1.default.NOT_FOUND).json(new ApiResponse(http_status_1.default.NOT_FOUND, "Address not found"));
    }
    if (address.user !== userId) {
        throw new ApiError(http_status_1.default.FORBIDDEN, "You are not authorized to set this address as default");
    }
    await address_model_1.Address.findOneAndUpdate({ user: userId, isDefault: true }, { $set: { isDefault: false } });
    address.isDefault = true;
    await address.save();
    await redis_1.redis.deleteByPattern(`addresses:user:${userId}*`);
    await redis_1.redis.delete(`users:${userId}?populate=true`);
    await redis_1.redis.deleteByPattern(`address:${id}*`);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "Default address set successfully"));
    return;
});
exports.getAllAddresses = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, search, user, isDeleted } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)("addresses:all", req.query);
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
            const users = await user_model_1.User.aggregate([
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
    const pipeline = [];
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
    await redis_1.redis.set(cacheKey, result, 600);
    res
        .status(http_status_1.default.OK)
        .json(new ApiResponse(http_status_1.default.OK, "All addresses retrieved successfully", result));
});
//# sourceMappingURL=address.controller.js.map