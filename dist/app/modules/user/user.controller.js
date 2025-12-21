"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.checkEmailExists = exports.checkPhoneExists = exports.deleteUser = exports.recoverUser = exports.updatePassword = exports.getUserById = exports.getAllUsers = exports.updateUser = exports.getMe = exports.createUser = void 0;
const user_model_1 = require("./user.model");
const user_validation_1 = require("./user.validation");
const utils_1 = require("../../utils");
const redisKeys_1 = require("../../utils/redisKeys");
const cacheTTL_1 = require("../../utils/cacheTTL");
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const redis_1 = require("../../config/redis");
const mongoose_1 = __importDefault(require("mongoose"));
const user_interface_1 = require("./user.interface");
const auth_validation_1 = require("../auth/auth.validation");
const cloudinary_1 = require("../../config/cloudinary");
const invalidateCache_1 = require("../../utils/invalidateCache");
const ApiError = (0, interface_1.getApiErrorClass)("USER");
const ApiResponse = (0, interface_1.getApiResponseClass)("USER");
exports.createUser = (0, utils_1.asyncHandler)(async (req, res) => {
    const { name, password, phone, email } = auth_validation_1.registerValidation.parse(req.body);
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        let user = await user_model_1.User.findOne({ $or: [{ phone }, { email }], isDeleted: false }).session(session);
        if (user) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, "User already exists with this phone or email.");
        }
        user = new user_model_1.User({ name, password, phone, email, status: user_interface_1.UserStatus.ACTIVE });
        await user.save({ session });
        await session.commitTransaction();
        session.endSession();
        await (0, invalidateCache_1.invalidateUserCaches)();
        const { password: _, otp: __, otpExpires: ___, ...userObject } = user.toJSON();
        res
            .status(http_status_1.default.CREATED)
            .json(new ApiResponse(http_status_1.default.CREATED, `User created and verified successfully.`, userObject));
    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
});
exports.getMe = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const cacheKey = redisKeys_1.RedisKeys.USER_BY_ID(String(userId));
    const cachedUser = await redis_1.redis.get(cacheKey);
    if (cachedUser) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "User profile retrieved successfully", cachedUser));
    }
    const user = await user_model_1.User.findOne({ _id: userId, isDeleted: false }, { password: 0, otp: 0, otpExpires: 0 });
    if (!user) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    const userObj = user?.toObject ? user.toObject() : user;
    await redis_1.redis.set(cacheKey, userObj, cacheTTL_1.CacheTTL.MEDIUM);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, "User profile retrieved successfully", user));
    return;
});
exports.updateUser = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const validatedData = user_validation_1.updateUserValidation.parse(req.body);
    const user = await user_model_1.User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    if (validatedData.email && validatedData.email.length > 0) {
        const existingUser = await user_model_1.User.findOne({
            email: validatedData.email,
            _id: { $ne: userId },
            isDeleted: false
        });
        if (existingUser) {
            throw new ApiError(http_status_1.default.BAD_REQUEST, "Email already exists");
        }
    }
    if (validatedData.email === '') {
        delete validatedData.email;
    }
    if (req.file) {
        validatedData.img = req.file.path;
        if (user.img) {
            const publicId = user.img.split("/").pop()?.split(".")[0];
            if (publicId)
                await cloudinary_1.cloudinary.uploader.destroy(`pravesh-users/${publicId}`);
        }
    }
    const updatedUser = await user_model_1.User.findByIdAndUpdate(userId, validatedData, { new: true, select: '-password -otp -otpExpires' });
    if (!updatedUser) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    await (0, invalidateCache_1.invalidateUserCaches)(String(userId));
    res.json(new ApiResponse(http_status_1.default.OK, "User updated successfully", updatedUser));
    return;
});
exports.getAllUsers = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, search, role, status: userStatus, isDeleted } = req.query;
    const cacheKey = redisKeys_1.RedisKeys.USERS_LIST(req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return res.json(new ApiResponse(http_status_1.default.OK, "Users retrieved successfully", cached));
    const filter = {};
    if (role)
        filter.role = role;
    if (userStatus)
        filter.status = userStatus;
    if (isDeleted !== undefined)
        filter.isDeleted = isDeleted === "true";
    else
        filter.isDeleted = false;
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline = [];
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        const searchCriteria = {
            $or: [
                { name: { $regex: searchRegex } },
                { email: { $regex: searchRegex } },
                { phone: { $regex: searchRegex } }
            ]
        };
        pipeline.push({ $match: searchCriteria });
    }
    pipeline.push({ $match: filter });
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
    const users = await user_model_1.User.aggregate(pipeline);
    const total = await user_model_1.User.countDocuments(filter);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        users,
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, cacheTTL_1.CacheTTL.SHORT);
    res.json(new ApiResponse(http_status_1.default.OK, "Users retrieved successfully", result));
});
exports.getUserById = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.params.id;
    const { populate = 'false' } = req.query;
    const cacheKey = redisKeys_1.RedisKeys.USER_BY_ID(userId, req.query);
    const cachedUser = await redis_1.redis.get(cacheKey);
    if (cachedUser) {
        return res.json(new ApiResponse(http_status_1.default.OK, "User retrieved successfully", cachedUser));
    }
    let user;
    if (populate == 'true') {
        user = await user_model_1.User.findOne({ _id: userId, isDeleted: false }, { password: 0 }).populate([
            {
                path: 'reviews',
                options: { limit: 5, sort: { createdAt: -1 } },
            },
            {
                path: 'addresses',
                options: { limit: 5 },
            },
            {
                path: 'orders',
                options: { limit: 5, sort: { createdAt: -1 } },
            },
            {
                path: 'wallet',
            },
            {
                path: 'cart',
            },
            {
                path: 'wishlist',
            },
        ]);
    }
    else {
        user = await user_model_1.User.findOne({ _id: userId, isDeleted: false }, { password: 0, otp: 0, otpExpires: 0 });
    }
    if (!user) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    const userObjDetail = user?.toObject ? user.toObject() : user;
    await redis_1.redis.set(cacheKey, userObjDetail, cacheTTL_1.CacheTTL.LONG);
    res.json(new ApiResponse(http_status_1.default.OK, "User retrieved successfully", user));
    return;
});
exports.updatePassword = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { currentPassword, newPassword } = user_validation_1.updatePasswordValidation.parse(req.body);
    const user = await user_model_1.User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Incorrect password");
    }
    user.password = newPassword;
    await user.save();
    res.json(new ApiResponse(http_status_1.default.OK, "Password reset successfully"));
    return;
});
exports.recoverUser = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const user = await user_model_1.User.findOne({ _id: id, isDeleted: false });
    if (!user) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    if (!user.isDeleted) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "User is already active");
    }
    user.isDeleted = false;
    await user.save();
    await (0, invalidateCache_1.invalidateUserCaches)(String(id));
    res.json(new ApiResponse(http_status_1.default.OK, "User recovered successfully"));
    return;
});
exports.deleteUser = (0, utils_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const user = await user_model_1.User.findOne({ _id: id, isDeleted: false });
    if (!user) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    user.isDeleted = true;
    await user.save();
    await (0, invalidateCache_1.invalidateUserCaches)(String(id));
    res.json(new ApiResponse(http_status_1.default.OK, "User deleted successfully"));
    return;
});
exports.checkPhoneExists = (0, utils_1.asyncHandler)(async (req, res) => {
    const { phone } = user_validation_1.phoneCheckValidation.parse(req.params);
    const cacheKey = `user:phone:${phone}`;
    const cachedResult = await redis_1.redis.get(cacheKey);
    if (cachedResult !== null) {
        return res.json(new ApiResponse(http_status_1.default.OK, "Phone number exists", cachedResult));
    }
    const user = await user_model_1.User.findOne({ phone, isDeleted: false });
    const exists = !!user;
    await redis_1.redis.set(cacheKey, exists, cacheTTL_1.CacheTTL.SHORT);
    if (!exists) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Phone number not found");
    }
    res.json(new ApiResponse(http_status_1.default.OK, "Phone number exists", true));
    return;
});
exports.checkEmailExists = (0, utils_1.asyncHandler)(async (req, res) => {
    const { email } = user_validation_1.emailCheckValidation.parse(req.params);
    const cacheKey = `user:email:${email}`;
    const cachedResult = await redis_1.redis.get(cacheKey);
    if (cachedResult !== null) {
        return res.json(new ApiResponse(http_status_1.default.OK, "Email exists", cachedResult));
    }
    const user = await user_model_1.User.findOne({ email, isDeleted: false });
    const exists = !!user;
    await redis_1.redis.set(cacheKey, exists, cacheTTL_1.CacheTTL.SHORT);
    if (!exists) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "Email not found");
    }
    res.json(new ApiResponse(http_status_1.default.OK, "Email exists", true));
    return;
});
exports.resetPassword = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const { otp, newPassword } = user_validation_1.resetPasswordValidation.parse(req.body);
    const user = await user_model_1.User.findById(userId);
    if (!user || user.isDeleted) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    if (!user.compareOtp(otp)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid or expired OTP");
    }
    user.password = newPassword;
    await user.save();
    res.json(new ApiResponse(http_status_1.default.OK, "Password reset successfully"));
    return;
});
//# sourceMappingURL=user.controller.js.map