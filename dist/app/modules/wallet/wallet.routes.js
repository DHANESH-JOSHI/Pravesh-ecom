"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletRouter = void 0;
const express_1 = __importDefault(require("express"));
const wallet_controller_1 = require("./wallet.controller");
const middlewares_1 = require("../../middlewares");
const router = express_1.default.Router();
router.get('/', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, wallet_controller_1.getAllWallets);
router.post('/add', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, wallet_controller_1.addFundsToWallet);
router.get('/balance', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, wallet_controller_1.getWalletBalance);
router.get('/transactions', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, wallet_controller_1.getTransactions);
exports.walletRouter = router;
//# sourceMappingURL=wallet.routes.js.map