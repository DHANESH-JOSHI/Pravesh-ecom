import { User } from "./auth.model";
import { activateUserValidation, authValidation, emailCheckValidation, loginValidation, phoneCheckValidation, requestOtpValidation, resetPasswordValidation, updateUserValidation, verifyOtpValidation } from "./auth.validation";
import { asyncHandler, generateToken } from "@/utils";
import { ApiError, ApiResponse } from "@/interface";

export const signUpController = asyncHandler(async (req, res, next): Promise<void> => {
  const { name, password, img, phone, email, role } = authValidation.parse(req.body);

  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new ApiError(400, "Email already exists");
  }

  // Check for existing phone
  const existingPhone = await User.findOne({ phone });
  if (existingPhone) {
    throw new ApiError(400, "Phone number already exists");
  }


  const user = new User({ name, password, img, phone, email, role });
  await user.save();

  const { password: _, ...userObject } = user.toObject();

  res.status(201).json(new ApiResponse(200, "User registered successfully", userObject));
  return;
});


// Utility function to generate OTP
const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// get logged in user profile
export const getMe = asyncHandler(async (req, res, next): Promise<void> => {
  res.status(200).json(new ApiResponse(200, "User profile retrieved successfully", req.user));
});

// Request OTP handler
export const requestOtp = asyncHandler(async (req, res, next): Promise<void> => {
  const { phone } = requestOtpValidation.parse(req.body);

  // Find or create user
  let user = await User.findOne({ phone });

  if (!user) {
    user = new User({
      phone,
      role: 'user',
      status: 'active'
    });
  }

  // Generate OTP and set expiration
  const otp = generateOTP();
  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);

  await user.save();

  res.json(new ApiResponse(200, "OTP sent successfully", { otp, phone }));
  return;
});

// Verify OTP and login
export const verifyOtp = asyncHandler(async (req, res, next): Promise<void> => {
  const { phone, otp } = verifyOtpValidation.parse(req.body);

  // Find user by phone
  const user = await User.findOne({ phone });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Check if OTP is valid and not expired
  if (!user.compareOtp(otp)) {
    throw new ApiError(401, "Invalid or expired OTP");
  }

  // Generate token for the user
  const token = generateToken(user);

  // Clear OTP after successful verification
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  // Remove password from response
  const { password: _, ...userObject } = user.toObject();

  res.json(new ApiResponse(200, "OTP verified successfully", { token, ...userObject }));
  return;
});

export const updateUser = asyncHandler(async (req, res, next): Promise<void> => {
  const userId = req.user?._id;
  // Validate the clean data
  const validatedData = updateUserValidation.parse(req.body);

  // Check if email is being updated with a non-empty value and if it already exists
  if (validatedData.email && validatedData.email.length > 0) {
    const existingUser = await User.findOne({
      email: validatedData.email,
      _id: { $ne: userId }
    });

    if (existingUser) {
      throw new ApiError(400, "Email already exists");
    }
  }

  // If email is empty string, remove it from update data
  if (validatedData.email === '') {
    delete validatedData.email;
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    validatedData,
    { new: true, select: '-password' }
  );

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  res.json(new ApiResponse(200, "User updated successfully", updatedUser));
  return;
});

export const loginController = asyncHandler(async (req, res, next): Promise<void> => {
  const { email, password } = loginValidation.parse(req.body);

  let user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(400, "Invalid email or password");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(400, "Invalid email or password");
  }

  const token = generateToken(user);

  // remove password
  const { password: _, ...userObject } = user.toObject();

  res.json(new ApiResponse(200, "User logged in successfully", { token, ...userObject }));
  return;
});

export const getAllUsers = asyncHandler(async (req, res, next): Promise<void> => {
  const users = await User.find({}, { password: 0 });

  if (users.length === 0) {
    throw new ApiError(404, "No users found");
  }

  res.json(new ApiResponse(200, "Users retrieved successfully", users));
  return;
});

export const getUserById = asyncHandler(async (req, res, next): Promise<void> => {
  const userId = req.params.id;
  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }
  const user = await User.findById(userId, { password: 0 });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.json(new ApiResponse(200, "User retrieved successfully", user));
  return;
});

export const resetPassword = asyncHandler(async (req, res, next): Promise<void> => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }
  const { newPassword } = resetPasswordValidation.parse(req.body);

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  user.password = newPassword;
  await user.save();

  res.json(new ApiResponse(200, "Password reset successfully"));
  return;
});

export const activateUser = asyncHandler(async (req, res, next): Promise<void> => {
  const { phone } = activateUserValidation.parse(req.body);

  const user = await User.findOne({ phone });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  (user as any).status = 'active';
  await user.save();

  res.json(new ApiResponse(200, "User activated successfully"));
  return;
});

export const checkPhoneExists = asyncHandler(async (req, res, next): Promise<void> => {
  const { phone } = phoneCheckValidation.parse(req.body);

  const user = await User.findOne({ phone });

  if (!user) {
    throw new ApiError(404, "Phone number not found");
  }

  res.json(new ApiResponse(200, "Phone number exists", { exists: true, phone: user.phone }));
  return;
});

export const checkEmailExists = asyncHandler(async (req, res, next): Promise<void> => {
  const { email } = emailCheckValidation.parse(req.body);

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "Email not found");
  }

  res.json(new ApiResponse(200, "Email exists", { exists: true, email: user.email }));
  return;
});
