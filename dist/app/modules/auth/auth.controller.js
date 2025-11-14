"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokens = exports.logout = exports.loginUsingOtp = exports.loginAsAdminUsingOtp = exports.requestForOtp = exports.loginAsAdmin = exports.loginUser = exports.registerUser = void 0;
const utils_1 = require("../../utils");
const user_model_1 = require("../user/user.model");
const auth_validation_1 = require("./auth.validation");
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const wallet_model_1 = require("../wallet/wallet.model");
const mongoose_1 = __importDefault(require("mongoose"));
const user_interface_1 = require("../user/user.interface");
const ApiError = (0, interface_1.getApiErrorClass)("AUTH");
const ApiResponse = (0, interface_1.getApiResponseClass)("AUTH");
exports.registerUser = (0, utils_1.asyncHandler)(async (req, res) => {
    const { name, password, phone, email } = auth_validation_1.registerValidation.parse(req.body);
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    let user;
    try {
        user = await user_model_1.User.findOne({ phone }).session(session);
        if (user) {
            // If user has a different email and a new one is provided
            if (email && user.email !== email) {
                const emailExists = await user_model_1.User.findOne({ email }).session(session);
                if (emailExists) {
                    if (emailExists.status === user_interface_1.UserStatus.ACTIVE) {
                        throw new ApiError(http_status_1.default.BAD_REQUEST, "User already registered with this phone, and email belongs to another account.");
                    }
                    await user_model_1.User.deleteOne({ _id: emailExists._id }, { session });
                }
                user.email = email;
            }
        }
        else {
            // user not found by phone
            if (email) {
                const existingEmailUser = await user_model_1.User.findOne({ email }).session(session);
                if (existingEmailUser) {
                    if (existingEmailUser.status === user_interface_1.UserStatus.ACTIVE) {
                        throw new ApiError(http_status_1.default.BAD_REQUEST, "User already registered with this email, and phone belongs to another account.");
                    }
                    user = existingEmailUser;
                    user.phone = phone;
                }
                else {
                    user = new user_model_1.User({ name, password, phone, email });
                    await user.save({ session });
                    await wallet_model_1.Wallet.create([{ user: user._id }], { session });
                }
            }
            else {
                user = new user_model_1.User({ name, password, phone });
                await user.save({ session });
                await wallet_model_1.Wallet.create([{ user: user._id }], { session });
            }
        }
        // User is pending verification — allow updating
        if (user.status === user_interface_1.UserStatus.PENDING) {
            user.name = name;
            user.password = password;
        }
        // issue new OTP
        user.otp = (0, utils_1.generateOTP)();
        user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
        await user.save({ session });
        await session.commitTransaction();
        session.endSession();
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
    // send otp to email if available
    if (email) {
        await (0, utils_1.sendEmail)(email, "OTP for Pravesh Registration", `Your OTP for Pravesh registration is ${user.otp}`);
    }
    // send otp to phone
    await (0, utils_1.sendSMS)(`Your OTP for Pravesh registration is ${user.otp}`, phone);
    // remove sensitive fields
    const { password: _, otp, otpExpires, ...userObject } = user.toJSON();
    res
        .status(http_status_1.default.CREATED)
        .json(new ApiResponse(http_status_1.default.CREATED, `OTP sent to phone ${email ? "and email" : ""} for registration verification.`, userObject));
    return;
});
exports.loginUser = (0, utils_1.asyncHandler)(async (req, res) => {
    const { phoneOrEmail, password } = auth_validation_1.loginValidation.parse(req.body);
    const user = await user_model_1.User.findOne({
        $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
    });
    if (!user || user.isDeleted) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    if (user.role !== user_interface_1.UserRole.USER) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "You do not have permission to perform this action");
    }
    if (user.status !== user_interface_1.UserStatus.ACTIVE) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "User account is not active");
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid password");
    }
    const { accessToken, refreshToken } = (0, utils_1.generateTokens)(user);
    const { password: _, otp: __, otpExpires, ...userObject } = user.toJSON();
    const isProd = process.env.NODE_ENV === 'production';
    res.
        cookie('accessToken', accessToken, { httpOnly: true, maxAge: 1000 * 15 * 60, secure: isProd, sameSite: isProd ? 'none' : 'lax' }).
        cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7, secure: isProd, sameSite: isProd ? 'none' : 'lax' })
        .json(new ApiResponse(http_status_1.default.OK, "User logged in successfully", { user: userObject, accessToken, refreshToken }));
    return;
});
exports.loginAsAdmin = (0, utils_1.asyncHandler)(async (req, res) => {
    const { phoneOrEmail, password } = auth_validation_1.loginValidation.parse(req.body);
    const user = await user_model_1.User.findOne({
        $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
    });
    if (!user || user.isDeleted) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    if (user.role !== user_interface_1.UserRole.ADMIN) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "You do not have permission to perform this action");
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid password");
    }
    const { accessToken, refreshToken } = (0, utils_1.generateTokens)(user);
    const { password: _, otp: __, otpExpires, ...userObject } = user.toJSON();
    const isProd = process.env.NODE_ENV === 'production';
    res.
        cookie('accessToken', accessToken, { httpOnly: true, maxAge: 1000 * 15 * 60, secure: isProd, sameSite: isProd ? 'none' : 'lax' }).
        cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 2, secure: isProd, sameSite: isProd ? 'none' : 'lax' })
        .json(new ApiResponse(http_status_1.default.OK, "Admin logged in successfully", { ...userObject }));
    return;
});
exports.requestForOtp = (0, utils_1.asyncHandler)(async (req, res) => {
    const { phoneOrEmail } = auth_validation_1.requestOtpValidation.parse(req.body);
    const user = await user_model_1.User.findOne({
        $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
    });
    if (!user || user.isDeleted) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    const isEmail = user.email === phoneOrEmail;
    const otp = (0, utils_1.generateOTP)();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    if (isEmail && user.email) {
        await (0, utils_1.sendEmail)(user.email, 'OTP for Pravesh login', `Your OTP for Pravesh login is ${otp}`);
    }
    if (!isEmail && user.phone) {
        await (0, utils_1.sendSMS)(`Your OTP for Pravesh login is ${otp}`, user.phone);
    }
    await user.save();
    res.json(new ApiResponse(http_status_1.default.OK, `OTP sent to ${isEmail ? 'email' : 'phone'} successfully`, { phoneOrEmail }));
    return;
});
exports.loginAsAdminUsingOtp = (0, utils_1.asyncHandler)(async (req, res) => {
    const { phoneOrEmail, otp } = auth_validation_1.verifyOtpValidation.parse(req.body);
    const user = await user_model_1.User.findOne({
        $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
    });
    if (!user || user.isDeleted) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    if (user.role !== user_interface_1.UserRole.ADMIN) {
        throw new ApiError(http_status_1.default.FORBIDDEN, "You do not have permission to perform this action");
    }
    if (!user.compareOtp(otp)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid or expired OTP");
    }
    if (user.status === user_interface_1.UserStatus.PENDING) {
        user.status = user_interface_1.UserStatus.ACTIVE;
    }
    const { accessToken, refreshToken } = (0, utils_1.generateTokens)(user);
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    const { password: _, otp: __, otpExpires, ...userObject } = user.toJSON();
    const isProd = process.env.NODE_ENV === 'production';
    res.
        cookie('accessToken', accessToken, { httpOnly: true, maxAge: 1000 * 15 * 60, secure: isProd, sameSite: isProd ? 'none' : 'lax' }).
        cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 2, secure: isProd, sameSite: isProd ? 'none' : 'lax' })
        .json(new ApiResponse(http_status_1.default.OK, "Admin logged in successfully", { ...userObject }));
    return;
});
exports.loginUsingOtp = (0, utils_1.asyncHandler)(async (req, res) => {
    const { phoneOrEmail, otp } = auth_validation_1.verifyOtpValidation.parse(req.body);
    const user = await user_model_1.User.findOne({
        $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
    });
    if (!user || user.isDeleted) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    if (user.role !== user_interface_1.UserRole.USER) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "You do not have permission to perform this action");
    }
    if (!user.compareOtp(otp)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid or expired OTP");
    }
    if (user.status === user_interface_1.UserStatus.PENDING) {
        user.status = user_interface_1.UserStatus.ACTIVE;
    }
    const { accessToken, refreshToken } = (0, utils_1.generateTokens)(user);
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    const { password: _, otp: __, otpExpires, ...userObject } = user.toJSON();
    const isProd = process.env.NODE_ENV === 'production';
    res.
        cookie('accessToken', accessToken, { httpOnly: true, maxAge: 1000 * 15 * 60, secure: isProd, sameSite: isProd ? 'none' : 'lax' }).
        cookie('refreshToken', refreshToken, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7, secure: isProd, sameSite: isProd ? 'none' : 'lax' })
        .json(new ApiResponse(http_status_1.default.OK, "User logged in successfully", { user: userObject, accessToken, refreshToken }));
    return;
});
exports.logout = (0, utils_1.asyncHandler)(async (req, res) => {
    res.clearCookie('accessToken').clearCookie('refreshToken').json(new ApiResponse(http_status_1.default.OK, "Logged out successfully"));
    return;
});
exports.refreshTokens = (0, utils_1.asyncHandler)(async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.headers.authorization?.replace('Bearer ', '');
    if (!refreshToken) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Refresh token not provided");
    }
    const decodedToken = (0, utils_1.verifyToken)(refreshToken);
    if (!decodedToken) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, "Invalid refresh token");
    }
    const user = await user_model_1.User.findById(decodedToken.userId);
    if (!user) {
        throw new ApiError(http_status_1.default.NOT_FOUND, "User not found");
    }
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = (0, utils_1.generateTokens)(user);
    const isProd = process.env.NODE_ENV === 'production';
    res.
        cookie('accessToken', newAccessToken, { httpOnly: true, maxAge: 1000 * 15 * 60, secure: isProd, sameSite: isProd ? 'none' : 'lax' }).
        cookie('refreshToken', newRefreshToken, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * (user.role === 'admin' ? 2 : 7), secure: isProd, sameSite: isProd ? 'none' : 'lax' })
        .json(new ApiResponse(http_status_1.default.OK, "Tokens refreshed successfully", { accessToken: newAccessToken, refreshToken: newRefreshToken }));
    return;
});
//# sourceMappingURL=auth.controller.js.map