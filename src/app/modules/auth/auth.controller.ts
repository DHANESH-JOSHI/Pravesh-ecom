import { asyncHandler, generateToken, sendEmail, sendSMS } from "@/utils";
import { User } from "../user/user.model";
import { loginValidation, registerValidation, requestOtpValidation, verifyOtpValidation } from "./auth.validation";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import { generateOTP } from "@/utils";
import status from "http-status";
import { UserStatus } from "../user/user.interface";

const ApiError = getApiErrorClass("AUTH");
const ApiResponse = getApiResponseClass("AUTH");

export const registerUser = asyncHandler(async (req, res) => {
  const { name, password, img, phone, email, role } = registerValidation.parse(req.body);

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new ApiError(status.BAD_REQUEST, "Email already exists");
  }

  // Check for existing phone
  const existingPhone = await User.findOne({ phone });
  if (existingPhone) {
    throw new ApiError(status.BAD_REQUEST, "Phone number already exists");
  }

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  const user = new User({ name, password, img, phone, email, role, otp, otpExpires });
  await user.save();

  await sendEmail(email, 'OTP for Pravesh registration', `Your OTP for Pravesh registration is ${otp}`);
  await sendSMS(`Your OTP for Pravesh registration is ${otp}`, phone);

  const { password: _, ...userObject } = user.toObject();

  res.status(status.CREATED).json(new ApiResponse(status.OK, "OTP sent to email and phone for registration verification", userObject));
  return;
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = loginValidation.parse(req.body);

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(status.BAD_REQUEST, "Invalid email or password");
  }
  if (user.status !== UserStatus.ACTIVE) {
    throw new ApiError(status.UNAUTHORIZED, "User account is not active");
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(status.BAD_REQUEST, "Invalid email or password");
  }

  const token = generateToken(user);

  // remove password
  const { password: _, ...userObject } = user.toObject();

  res.json(new ApiResponse(status.OK, "User logged in successfully", { token, ...userObject }));
  return;
});

// Request OTP handler
export const requestForOtp = asyncHandler(async (req, res) => {
  const { phoneOrEmail } = requestOtpValidation.parse(req.body);

  let isEmail = false;
  // Find or create user
  let user = await User.findOne({ phone: phoneOrEmail })
  if (!user) {
    user = await User.findOne({ email: phoneOrEmail })
    isEmail = true;
  }

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  // Generate OTP and set expiration
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

// Verify OTP and login
export const verifyOtp = asyncHandler(async (req, res) => {
  const { phoneOrEmail, otp } = verifyOtpValidation.parse(req.body);

  // Find user by phone
  let user = await User.findOne({ phone: phoneOrEmail });

  if (!user) {
    user = await User.findOne({ email: phoneOrEmail })
  }

  if (!user) {
    throw new ApiError(status.NOT_FOUND, "User not found");
  }

  // Check if OTP is valid and not expired
  if (!user.compareOtp(otp)) {
    throw new ApiError(status.UNAUTHORIZED, "Invalid or expired OTP");
  }

  if (user.status === UserStatus.PENDING) {
    user.status = UserStatus.ACTIVE;
  }
  // Generate token for the user
  const token = generateToken(user);

  // Clear OTP after successful verification
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  // Remove password from response
  const { password: _, ...userObject } = user.toObject();

  res.json(new ApiResponse(status.OK, "OTP verified successfully", { token, ...userObject }));
  return;
});