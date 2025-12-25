import { asyncHandler, generateTokens, sendEmail, sendSMS, verifyToken, generateOTP } from "@/utils";
import { User } from "../user/user.model";
import { loginValidation, registerValidation, requestOtpValidation, verifyOtpValidation } from "./auth.validation";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import status from "http-status";
import mongoose from "mongoose";
import { UserRole, UserStatus } from "../user/user.interface";
import { getCookieNamesFromRequest } from "@/utils/cookieUtils";

const ApiError = getApiErrorClass("AUTH");
const ApiResponse = getApiResponseClass("AUTH");

export const registerUser = asyncHandler(async (req, res) => {
  const { name, password, phone, email } = registerValidation.parse(req.body);

  const session = await mongoose.startSession();
  session.startTransaction();
  let user;
  try {
    user = await User.findOne({ phone }).session(session);
    if (user) {
      // If user has a different email and a new one is provided
      if (email && user.email !== email) {
        const emailExists = await User.findOne({ email }).session(session);
        if (emailExists) {
          if (emailExists.status === UserStatus.ACTIVE) {
            throw new ApiError(
              status.BAD_REQUEST,
              "User already registered with this phone, and email belongs to another account."
            );
          }
          await User.deleteOne({ _id: emailExists._id }, { session });
        }
        user.email = email;
      }
    }
    else {
      // user not found by phone
      if (email) {
        const existingEmailUser = await User.findOne({ email }).session(session);
        if (existingEmailUser) {
          if (existingEmailUser.status === UserStatus.ACTIVE) {
            throw new ApiError(status.BAD_REQUEST, "User already registered with this email, and phone belongs to another account.");
          }
          user = existingEmailUser;
          user.phone = phone;
        } else {
          user = new User({ name, password, phone, email });
          await user.save({ session });
        }
      } else {
        user = new User({ name, password, phone });
        await user.save({ session });
      }
    }
    // User is pending verification — allow updating
    if (user.status === UserStatus.PENDING) {
      user.name = name;
      user.password = password;
    }

    // issue new OTP
    user.otp = generateOTP();
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
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
  return;
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
    throw new ApiError(status.BAD_REQUEST, "You do not have permission to perform this action");
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
  const isProd = process.env.NODE_ENV === 'production';
  const cookieNames = getCookieNamesFromRequest(req);
  res.
    cookie(cookieNames.accessToken, accessToken,
      { httpOnly: true, maxAge: 1000 * 15 * 60, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' }).
    cookie(cookieNames.refreshToken, refreshToken,
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' })
    .json(new ApiResponse(status.OK, "User logged in successfully", { user: userObject, accessToken, refreshToken }));
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

  // Allow admin or staff roles to login as admin
  if (![UserRole.ADMIN, UserRole.STAFF].includes(user.role as UserRole)) {
    throw new ApiError(status.BAD_REQUEST, "You do not have permission to perform this action");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(status.BAD_REQUEST, "Invalid password");
  }
  const { accessToken, refreshToken } = generateTokens(user);
  const { password: _, otp: __, otpExpires, ...userObject } = user.toJSON();
  const isProd = process.env.NODE_ENV === 'production';
  const cookieNames = getCookieNamesFromRequest(req);
  res.
    cookie(cookieNames.accessToken, accessToken,
      { httpOnly: true, maxAge: 1000 * 15 * 60, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' }).
    cookie(cookieNames.refreshToken, refreshToken,
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 2, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' })
    .json(new ApiResponse(status.OK, "Admin logged in successfully", { ...userObject }));
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

  // Allow admin or staff roles to login as admin
  if (![UserRole.ADMIN, UserRole.STAFF].includes(user.role as UserRole)) {
    throw new ApiError(status.FORBIDDEN, "You do not have permission to perform this action");
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
  const isProd = process.env.NODE_ENV === 'production';
  const cookieNames = getCookieNamesFromRequest(req);
  res.
    cookie(cookieNames.accessToken, accessToken,
      { httpOnly: true, maxAge: 1000 * 15 * 60, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' }).
    cookie(cookieNames.refreshToken, refreshToken,
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 2, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' })
    .json(new ApiResponse(status.OK, "Admin logged in successfully", { ...userObject }));
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
    throw new ApiError(status.BAD_REQUEST, "You do not have permission to perform this action");
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
  const isProd = process.env.NODE_ENV === 'production';
  const cookieNames = getCookieNamesFromRequest(req);
  res.
    cookie(cookieNames.accessToken, accessToken,
      { httpOnly: true, maxAge: 1000 * 15 * 60, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' }).
    cookie(cookieNames.refreshToken, refreshToken,
      { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' })
    .json(new ApiResponse(status.OK, "User logged in successfully", { user: userObject, accessToken, refreshToken }));
  return;
});

export const logout = asyncHandler(async (req, res) => {
  const cookieNames = getCookieNamesFromRequest(req);
  const isProd = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    path: '/',
  };

  res
    .clearCookie('accessToken', cookieOptions)
    .clearCookie('refreshToken', cookieOptions)
    .clearCookie(cookieNames.accessToken, cookieOptions)
    .clearCookie(cookieNames.refreshToken, cookieOptions)
    .json(new ApiResponse(status.OK, "Logged out successfully"));
  return;
});

export const refreshTokens = asyncHandler(async (req, res) => {
  const cookieNames = getCookieNamesFromRequest(req);
  const refreshToken = req.cookies[cookieNames.refreshToken] ||
    req.headers.authorization?.replace('Bearer ', '');
  if (!refreshToken) {
    throw new ApiError(status.BAD_REQUEST, "Refresh token not provided");
  }
  const decodedToken = verifyToken(refreshToken);
  if (!decodedToken) {
    throw new ApiError(status.BAD_REQUEST, "Invalid refresh token");
  }
  const user = await User.findById(decodedToken.userId);

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user);
  const isProd = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    path: '/',
  };

  res
    .clearCookie('accessToken', cookieOptions)
    .clearCookie('refreshToken', cookieOptions)
    .clearCookie(cookieNames.accessToken, cookieOptions)
    .clearCookie(cookieNames.refreshToken, cookieOptions)
    .cookie(cookieNames.accessToken, newAccessToken,
      { ...cookieOptions, maxAge: 1000 * 15 * 60 })
    .cookie(cookieNames.refreshToken, newRefreshToken,
      { ...cookieOptions, maxAge: 1000 * 60 * 60 * 24 * (user.role === 'admin' ? 2 : 7) })
    .json(new ApiResponse(status.OK, "Tokens refreshed successfully", { accessToken: newAccessToken, refreshToken: newRefreshToken }));
  return;
});


