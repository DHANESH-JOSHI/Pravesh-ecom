import { asyncHandler, generateTokens, sendEmail, sendSMS, verifyToken, generateOTP } from "@/utils";
import { User } from "../user/user.model";
import { loginValidation, registerValidation, requestOtpValidation, verifyOtpValidation } from "./auth.validation";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
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

  try {
    let user = await User.findOne({ phone }).session(session);

    if (user) {
      // If user has a different email and a new one is provided
      if (email && user.email !== email) {
        const emailExists = await User.findOne({ email }).session(session);
        if (emailExists) {
          throw new ApiError(
            status.BAD_REQUEST,
            "User already registered with this phone, and email belongs to another account."
          );
        }
        user.email = email;
      }
    }

    // No user found by phone — check if email exists
    else {
      if (email) {
        const existingEmailUser = await User.findOne({ email }).session(session);
        if (existingEmailUser) {
          throw new ApiError(
            status.BAD_REQUEST,
            "User already registered with this email, and phone belongs to another account."
          );
        }
      }

      // Create new user
      user = new User({ name, password, img, phone, email });
      await user.save({ session });
      // create wallet for user
      await Wallet.create([{ user: user._id }], { session });
    }

    // User is pending verification — allow updating
    if (user.status === UserStatus.PENDING) {
      user.name = name;
      user.password = password;
      if (img) user.img = img;
    }

    // issue new OTP
    user.otp = generateOTP();
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    // send otp to email if available
    if (email) {
      await sendEmail(
        email,
        "OTP for Pravesh Registration",
        `Your OTP for Pravesh registration is ${user.otp}`
      );
    }
    // send otp to phone
    await sendSMS(`Your OTP for Pravesh registration is ${user.otp}`, phone);

    // remove sensitive fields
    const { password: _, otp, otpExpires, ...userObject } = user.toJSON();

    res
      .status(status.CREATED)
      .json(
        new ApiResponse(
          status.CREATED,
          `OTP sent to phone ${email ? "and email" : ""} for registration verification.`,
          userObject
        )
      );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

export const loginUser = asyncHandler(async (req, res) => {
  const { phoneOrEmail, password } = loginValidation.parse(req.body);
  const user = await User.findOne({
    $or: [{ phone: phoneOrEmail }, { email: phoneOrEmail }]
  })
  if (!user || user.isDeleted) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }
  if (user.role !== UserRole.USER) {
    throw new ApiError(status.BAD_REQUEST, "User role is not user");
  }
  if (user.status !== UserStatus.ACTIVE) {
    throw new ApiError(status.BAD_REQUEST, "User account is not active");
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
    .json(new ApiResponse(status.OK, "OTP verified successfully", { user: userObject, accessToken, refreshToken }));
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
    throw new ApiError(status.BAD_REQUEST, "User is not an admin");
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
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 2, secure: true, sameSite: 'lax' })
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

  res.json(new ApiResponse(status.OK, `OTP sent to ${isEmail ? 'email' : 'phone'} successfully`, { phoneOrEmail }));
  return;
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
    throw new ApiError(status.BAD_REQUEST, "Unauthorized");
  }

  if (!user.compareOtp(otp)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid or expired OTP");
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
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 2, secure: true, sameSite: 'lax' })
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

  if (user.role !== UserRole.USER) {
    throw new ApiError(status.BAD_REQUEST, "User role is not user");
  }

  if (!user.compareOtp(otp)) {
    throw new ApiError(status.BAD_REQUEST, "Invalid or expired OTP");
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
  const { refreshToken } = req.cookies ;

  const decodedToken = verifyToken(refreshToken);
  if (!decodedToken) {
    throw new ApiError(status.BAD_REQUEST, "Invalid refresh token");
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
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * (user.role === 'admin' ? 2 : 7), secure: true, sameSite: 'lax' })
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


