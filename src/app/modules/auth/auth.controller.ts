import { asyncHandler, generateTokens, sendEmail, sendSMS, verifyToken } from "@/utils";
import { User } from "../user/user.model";
import { loginValidation, registerValidation, requestOtpValidation, verifyOtpValidation } from "./auth.validation";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import { generateOTP } from "@/utils";
import status from "http-status";
import { Wallet } from '../wallet/wallet.model';
import mongoose from "mongoose";
import { UserRole, UserStatus } from "../user/user.interface";
import { resetPasswordValidation } from "../user/user.validation";

const ApiError = getApiErrorClass("AUTH");
const ApiResponse = getApiResponseClass("AUTH");

export const registerUser = asyncHandler(async (req, res) => {
  const { name, password, img, phone, email } = registerValidation.parse(req.body);

  const session = await mongoose.startSession();
  session.startTransaction();
  let user;

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] }).session(session);
    if (existingUser) {
      if (existingUser.email === email) {
        throw new ApiError(status.BAD_REQUEST, "Email already exists");
      }
      if (existingUser.phone === phone) {
        throw new ApiError(status.BAD_REQUEST, "Phone number already exists");
      }
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    const newUser = new User({ name, password, img, phone, email, otp, otpExpires });
    await newUser.save({ session });
    user = newUser;

    await Wallet.create([{ userId: user._id }], { session });

    await session.commitTransaction();

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
  if (email) await sendEmail(email, 'OTP for Pravesh registration', `Your OTP for Pravesh registration is ${user.otp}`);
  await sendSMS(`Your OTP for Pravesh registration is ${user.otp}`, phone);
  const { password: _, otp, otpExpires, ...userObject } = user.toJSON();
  res.status(status.CREATED).json(new ApiResponse(status.OK, "OTP sent to email and phone for registration verification", userObject));
});

export const loginUser = asyncHandler(async (req, res) => {
  const { phoneOrEmail, password } = loginValidation.parse(req.body);
  const user = await User.findOne({
    $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
  })
  if (!user || user.isDeleted) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  if (user.status !== UserStatus.ACTIVE) {
    throw new ApiError(status.UNAUTHORIZED, "User account is not active");
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(status.BAD_REQUEST, "Invalid password");
  }
  const { accessToken, refreshToken } = generateTokens(user);
  const { password: _, otp: __, otpExpires, ...userObject } = user.toJSON();

  res.
    cookie('accessToken', accessToken,
      { httpOnly: true, maxAge: 1000 * 15 * 60, secure: true, sameSite: 'lax' }).
    cookie('refreshToken', refreshToken,
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7, secure: true, sameSite: 'lax' })
    .json(new ApiResponse(status.OK, "OTP verified successfully", { ...userObject }));
  return;
});

export const loginAsAdmin = asyncHandler(async (req, res) => {
  const { phoneOrEmail, password } = loginValidation.parse(req.body);
  const user = await User.findOne({
    $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
  })
  if (!user || user.isDeleted) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (user.role !== UserRole.ADMIN) {
    throw new ApiError(status.UNAUTHORIZED, "User is not an admin");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(status.BAD_REQUEST, "Invalid password");
  }
  const { accessToken, refreshToken } = generateTokens(user);
  const { password: _, otp: __, otpExpires, ...userObject } = user.toJSON();

  res.
    cookie('accessToken', accessToken,
      { httpOnly: true, maxAge: 1000 * 15 * 60, secure: true, sameSite: 'lax' }).
    cookie('refreshToken', refreshToken,
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7, secure: true, sameSite: 'lax' })
    .json(new ApiResponse(status.OK, "OTP verified successfully", { ...userObject }));
  return;
});

export const requestForOtp = asyncHandler(async (req, res) => {
  const { phoneOrEmail } = requestOtpValidation.parse(req.body);

  const user = await User.findOne({
    $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
  })
  if (!user || user.isDeleted) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  const isEmail = user.email === phoneOrEmail;

  const otp = generateOTP();
  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  if (isEmail && user.email) {
    await sendEmail(user.email, 'OTP for Pravesh login', `Your OTP for Pravesh login is ${otp}`)
  }

  if (!isEmail && user.phone) {
    await sendSMS(`Your OTP for Pravesh login is ${otp}`, user.phone)
  }

  await user.save();

  res.json(new ApiResponse(status.OK, "OTP sent successfully", { phoneOrEmail }));
});

export const loginAsAdminUsingOtp = asyncHandler(async (req, res) => {
  const { phoneOrEmail, otp } = verifyOtpValidation.parse(req.body);

  const user = await User.findOne({
    $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
  })
  if (!user || user.isDeleted) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (user.role !== UserRole.ADMIN) {
    throw new ApiError(status.FORBIDDEN, "Unauthorized");
  }

  if (!user.compareOtp(otp)) {
    throw new ApiError(status.UNAUTHORIZED, "Invalid or expired OTP");
  }

  if (user.status === UserStatus.PENDING) {
    user.status = UserStatus.ACTIVE;
  }
  const { accessToken, refreshToken } = generateTokens(user);

  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  const { password: _, otp: __, otpExpires, ...userObject } = user.toJSON();

  res.
    cookie('accessToken', accessToken,
      { httpOnly: true, maxAge: 1000 * 15 * 60, secure: true, sameSite: 'lax' }).
    cookie('refreshToken', refreshToken,
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7, secure: true, sameSite: 'lax' })
    .json(new ApiResponse(status.OK, "OTP verified successfully", { ...userObject }));
  return;
})

export const loginUsingOtp = asyncHandler(async (req, res) => {
  const { phoneOrEmail, otp } = verifyOtpValidation.parse(req.body);

  const user = await User.findOne({
    $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
  })
  if (!user || user.isDeleted) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  if (!user.compareOtp(otp)) {
    throw new ApiError(status.UNAUTHORIZED, "Invalid or expired OTP");
  }

  if (user.status === UserStatus.PENDING) {
    user.status = UserStatus.ACTIVE;
  }
  const { accessToken, refreshToken } = generateTokens(user);

  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  const { password: _, otp: __, otpExpires, ...userObject } = user.toJSON();

  res.
    cookie('accessToken', accessToken,
      { httpOnly: true, maxAge: 1000 * 15 * 60, secure: true, sameSite: 'lax' }).
    cookie('refreshToken', refreshToken,
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7, secure: true, sameSite: 'lax' })
    .json(new ApiResponse(status.OK, "OTP verified successfully", { ...userObject }));
  return;
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('accessToken').clearCookie('refreshToken').json(new ApiResponse(status.OK, "Logged out successfully"));
  return;
});

export const refreshTokens = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;

  const decodedToken = verifyToken(refreshToken);
  if (!decodedToken) {
    throw new ApiError(status.UNAUTHORIZED, "Invalid refresh token");
  }
  const user = await User.findById(decodedToken.userId);

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user);

  res.
    cookie('accessToken', newAccessToken,
      { httpOnly: true, maxAge: 1000 * 15 * 60, secure: true, sameSite: 'lax' }).
    cookie('refreshToken', newRefreshToken,
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7, secure: true, sameSite: 'lax' })
    .json(new ApiResponse(status.OK, "Tokens refreshed successfully", { accessToken: newAccessToken, refreshToken: newRefreshToken }));
  return;
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { phoneOrEmail, newPassword } = resetPasswordValidation.parse(req.body)
  const user = await User.findOne({
    $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
  })
  if (!user || user.isDeleted) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  user.password = newPassword;
  await user.save();
  res.json(new ApiResponse(status.OK, "Password reset successfully"));
  return;
})


