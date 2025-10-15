import { Wallet } from './wallet.model';
import { getApiErrorClass,getApiResponseClass } from '@/interface';
import { asyncHandler } from '@/utils';
import { addFundsValidation } from './wallet.validation';
import mongoose from 'mongoose';
import { User } from '../user/user.model';
const ApiError = getApiErrorClass("WALLET");
const ApiResponse = getApiResponseClass("WALLET");

export const getWalletBalance = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, 'User not authenticated');
    }
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
    }
    res.json(new ApiResponse(200, 'Wallet balance retrieved', { balance: wallet.balance }));
});

export const addFundsToWallet = asyncHandler(async (req, res) => {

    const { userId, amount, description } = addFundsValidation.parse(req.body);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Invalid user ID');
    }
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
        wallet = await Wallet.create({ userId: user._id, balance: 0, transactions: [] });
    }

    wallet.balance += amount;
    wallet.transactions.push({
        amount: amount,
        description: description || 'Credited by admin',
        createdAt: new Date(),
    });

    await wallet.save();

    res.json(new ApiResponse(200, 'Funds added to wallet successfully', {
        userId: wallet.userId,
        newBalance: wallet.balance
    }));
});

export const getTransactions = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, 'Unauthorized');
    }
    let wallet = await Wallet.findOne({ userId: userId });
    if (!wallet) {
        wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
    }
    res.json(new ApiResponse(200, 'Transactions retrieved', wallet.transactions));
});
