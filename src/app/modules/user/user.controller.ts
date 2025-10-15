import { User } from "./user.model";
import { activateUserValidation, emailCheckValidation, phoneCheckValidation, resetPasswordValidation, updateUserValidation } from "./user.validation";
import { asyncHandler } from "@/utils";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import { logger } from "@/config/logger";
const ApiError = getApiErrorClass("USER");
const ApiResponse = getApiResponseClass("USER");

// get logged in user profile
export const getMe = asyncHandler(async (req, res) => {
  logger.info('Fetching logged in user profile');
  res.status(200).json(new ApiResponse(200, "User profile retrieved successfully", req.user));
});

export const updateUser = asyncHandler(async (req, res) => {
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


export const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}, { password: 0 });

  if (users.length === 0) {
    throw new ApiError(404, "No users found");
  }

  res.json(new ApiResponse(200, "Users retrieved successfully", users));
  return;
});

export const getUserById = asyncHandler(async (req, res) => {
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

export const resetPassword = asyncHandler(async (req, res) => {
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

export const activateUser = asyncHandler(async (req, res) => {
  const { phone } = activateUserValidation.parse(req.body);

  const user = await User.findOne({ phone });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.status !== 'pending') {
    throw new ApiError(400, "User is already active");
  }

  user.status = 'active';
  await user.save();

  res.json(new ApiResponse(200, "User activated successfully"));
  return;
});

export const checkPhoneExists = asyncHandler(async (req, res) => {
  const { phone } = phoneCheckValidation.parse(req.params);

  const user = await User.findOne({ phone });

  if (!user) {
    throw new ApiError(404, "Phone number not found");
  }

  res.json(new ApiResponse(200, "Phone number exists", { exists: true, phone: user.phone }));
  return;
});

export const checkEmailExists = asyncHandler(async (req, res) => {
  const { email } = emailCheckValidation.parse(req.params);

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "Email not found");
  }

  res.json(new ApiResponse(200, "Email exists", { exists: true, email: user.email }));
  return;
});
