"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactions = exports.addFundsToWallet = exports.getWalletBalance = exports.getAllWallets = void 0;
const wallet_model_1 = require("./wallet.model");
const interface_1 = require("../../interface");
const utils_1 = require("../../utils");
const wallet_validation_1 = require("./wallet.validation");
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = require("../user/user.model");
const http_status_1 = __importDefault(require("http-status"));
const redis_1 = require("../../config/redis");
const ApiError = (0, interface_1.getApiErrorClass)("WALLET");
const ApiResponse = (0, interface_1.getApiResponseClass)("WALLET");
exports.getAllWallets = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 10, user } = req.query;
    const cacheKey = (0, utils_1.generateCacheKey)('wallets', req.query);
    const cachedWallets = await redis_1.redis.get(cacheKey);
    if (cachedWallets) {
        return res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Wallets retrieved successfully', cachedWallets));
    }
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};
    if (user) {
        if (mongoose_1.default.Types.ObjectId.isValid(user)) {
            filter.user = user;
        }
        else {
            const users = await user_model_1.User.find({
                $or: [
                    { name: { $regex: user, $options: 'i' } },
                    { email: { $regex: user, $options: 'i' } },
                    { phone: { $regex: user, $options: 'i' } }
                ]
            }).select('_id');
            const userIds = users.map(u => u._id);
            filter.user = { $in: userIds };
        }
    }
    const [wallets, total] = await Promise.all([
        wallet_model_1.Wallet.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('user', 'name email'),
        wallet_model_1.Wallet.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        wallets: wallets.map(wallet => {
            const walletObject = wallet.toJSON();
            return {
                ...walletObject,
                transactions: walletObject.transactions?.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) || []
            };
        }),
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages
    };
    await redis_1.redis.set(cacheKey, result, 600);
    res.status(http_status_1.default.OK).json(new ApiResponse(http_status_1.default.OK, 'Wallets retrieved successfully', result));
    return;
});
exports.getWalletBalance = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const cacheKey = `wallet:balance:${userId}`;
    const cachedBalance = await redis_1.redis.get(cacheKey);
    if (cachedBalance) {
        return res.json(new ApiResponse(http_status_1.default.OK, 'Wallet balance retrieved', cachedBalance));
    }
    const wallet = await wallet_model_1.Wallet.findOne({ user: userId });
    if (!wallet) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Wallet not found');
    }
    const result = { balance: wallet.balance };
    await redis_1.redis.set(cacheKey, result, 600);
    res.json(new ApiResponse(http_status_1.default.OK, 'Wallet balance retrieved', result));
    return;
});
exports.addFundsToWallet = (0, utils_1.asyncHandler)(async (req, res) => {
    const { userId, amount, description } = wallet_validation_1.addFundsValidation.parse(req.body);
    if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
        throw new ApiError(http_status_1.default.BAD_REQUEST, 'Invalid user ID');
    }
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'User not found');
    }
    const wallet = await wallet_model_1.Wallet.findOne({ user: user._id });
    if (!wallet) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Wallet not found for the specified user');
    }
    wallet.balance += amount;
    wallet.transactions.push({
        amount: amount,
        description: description || 'Credited by admin',
        createdAt: new Date(),
    });
    await wallet.save();
    await redis_1.redis.delete(`wallet:balance:${userId}`);
    await redis_1.redis.delete(`wallet:transactions:${userId}`);
    await redis_1.redis.deleteByPattern('wallets*');
    res.json(new ApiResponse(http_status_1.default.OK, 'Funds added to wallet successfully', {
        userId: wallet.user,
        newBalance: wallet.balance
    }));
    return;
});
exports.getTransactions = (0, utils_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const cacheKey = `wallet:transactions:${userId}`;
    const cachedTransactions = await redis_1.redis.get(cacheKey);
    if (cachedTransactions) {
        return res.json(new ApiResponse(http_status_1.default.OK, 'Transactions retrieved', cachedTransactions));
    }
    const wallet = await wallet_model_1.Wallet.findOne({ user: userId });
    if (wallet && wallet.transactions) {
        wallet.transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    if (!wallet) {
        throw new ApiError(http_status_1.default.NOT_FOUND, 'Wallet not found');
    }
    await redis_1.redis.set(cacheKey, wallet.transactions, 600);
    res.json(new ApiResponse(http_status_1.default.OK, 'Transactions retrieved', wallet.transactions));
    return;
});
//# sourceMappingURL=wallet.controller.js.map