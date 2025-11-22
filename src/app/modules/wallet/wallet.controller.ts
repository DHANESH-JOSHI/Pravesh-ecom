import { Wallet } from './wallet.model';
import { getApiErrorClass, getApiResponseClass } from '@/interface';
import { asyncHandler, generateCacheKey } from '@/utils';
import { addFundsValidation } from './wallet.validation';
import mongoose from 'mongoose';
import { User } from '../user/user.model';
import status from 'http-status';
import { redis } from '@/config/redis';
const ApiError = getApiErrorClass("WALLET");
const ApiResponse = getApiResponseClass("WALLET");

export const getAllWallets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, user } = req.query;

  const cacheKey = generateCacheKey("wallets", req.query);
  const cached = await redis.get(cacheKey);

  if (cached)
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Wallets retrieved successfully", cached));

  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};

  if (user) {
    if (mongoose.Types.ObjectId.isValid(user as string)) {
      filter.user = new mongoose.Types.ObjectId(user as string);
    } else {
      const users = await User.aggregate([
        {
          $search: {
            index: "user_search",
            compound: {
              should: [
                {
                  autocomplete: {
                    query: user,
                    path: "name",
                    fuzzy: { maxEdits: 1 }
                  }
                },
                {
                  autocomplete: {
                    query: user,
                    path: "email",
                    fuzzy: { maxEdits: 1 }
                  }
                },
                {
                  autocomplete: {
                    query: user,
                    path: "phone",
                    fuzzy: { maxEdits: 1 }
                  }
                }
              ]
            }
          }
        },
        { $project: { _id: 1 } }
      ]);

      filter.user = { $in: users.map((u) => u._id) };
    }
  }

  const pipeline: any[] = [];

  pipeline.push({ $match: filter });
  pipeline.push({ $sort: { createdAt: -1 } });
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Number(limit) });

  pipeline.push({
    $lookup: {
      from: "users",
      localField: "user",
      foreignField: "_id",
      pipeline: [
        { $project: { _id: 1, name: 1, email: 1 } }
      ],
      as: "user"
    }
  });

  pipeline.push({
    $unwind: { path: "$user", preserveNullAndEmptyArrays: true }
  });

  const wallets = await Wallet.aggregate(pipeline);
  const total = await Wallet.countDocuments(filter);
  const totalPages = Math.ceil(total / Number(limit));

  const result = {
    wallets: wallets.map((w) => ({
      ...w,
      transactions: w.transactions?.sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ) || []
    })),
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages
  };

  await redis.set(cacheKey, result, 600);

  res
    .status(status.OK)
    .json(new ApiResponse(status.OK, "Wallets retrieved successfully", result));
});

export const getWalletBalance = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const cacheKey = `wallet:balance:${userId}`;
  const cachedBalance = await redis.get(cacheKey);
  if (cachedBalance) {
    return res.json(new ApiResponse(status.OK, 'Wallet balance retrieved', cachedBalance));
  }

  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    throw new ApiError(status.NOT_FOUND, 'Wallet not found');
  }

  const result = { balance: wallet.balance };
  await redis.set(cacheKey, result, 600);

  res.json(new ApiResponse(status.OK, 'Wallet balance retrieved', result));
  return;
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
  const wallet = await Wallet.findOne({ user: user._id });
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

  await redis.delete(`wallet:balance:${userId}`);
  await redis.delete(`wallet:transactions:${userId}`);
  await redis.deleteByPattern('wallets*');

  res.json(new ApiResponse(status.OK, 'Funds added to wallet successfully', {
    userId: wallet.user,
    newBalance: wallet.balance
  }));
  return;
});

export const getTransactions = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const cacheKey = `wallet:transactions:${userId}`;
  const cachedTransactions = await redis.get(cacheKey);
  if (cachedTransactions) {
    return res.json(new ApiResponse(status.OK, 'Transactions retrieved', cachedTransactions));
  }

  const wallet = await Wallet.findOne({ user: userId });
  if (wallet && wallet.transactions) {
    wallet.transactions.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  if (!wallet) {
    throw new ApiError(status.NOT_FOUND, 'Wallet not found');
  }

  await redis.set(cacheKey, wallet.transactions, 600);
  res.json(new ApiResponse(status.OK, 'Transactions retrieved', wallet.transactions));
  return;
});
