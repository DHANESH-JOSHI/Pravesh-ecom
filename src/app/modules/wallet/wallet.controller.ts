import { Wallet } from './wallet.model';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { asyncHandler } from '@/utils';
import { addFundsValidation } from './wallet.validation';
import mongoose from 'mongoose';
import { User } from '../user/user.model';
import status from 'http-status';
const ApiError = getApiErrorClass("WALLET");
const ApiResponse = getApiResponseClass("WALLET");

export const getWalletBalance = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'User not authenticated');
  }
  const wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    throw new ApiError(status.NOT_FOUND, 'Wallet not found');
  }
  res.json(new ApiResponse(status.OK, 'Wallet balance retrieved', { balance: wallet.balance }));
});

export const addFundsToWallet = asyncHandler(async (req, res) => {

  const { userId, amount, description } = addFundsValidation.parse(req.body);

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(status.BAD_REQUEST, 'Invalid user ID');
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(status.NOT_FOUND, 'User not found');
  }
  const wallet = await Wallet.findOne({ userId: user._id });
  if (!wallet) {
    throw new ApiError(status.NOT_FOUND, 'Wallet not found for the specified user');
  }

  wallet.balance += amount;
  wallet.transactions.push({
    amount: amount,
    description: description || 'Credited by admin',
    createdAt: new Date(),
  });

  await wallet.save();

  res.json(new ApiResponse(status.OK, 'Funds added to wallet successfully', {
    userId: wallet.userId,
    newBalance: wallet.balance
  }));
});

export const getTransactions = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(status.UNAUTHORIZED, 'Unauthorized');
  }
  const wallet = await Wallet.findOne({ userId: userId });
  if (!wallet) {
    throw new ApiError(status.NOT_FOUND, 'Wallet not found');
  }
  res.json(new ApiResponse(status.OK, 'Transactions retrieved', wallet.transactions));
});
