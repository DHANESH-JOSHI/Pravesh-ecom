"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartRouter = void 0;
const express_1 = __importDefault(require("express"));
const cart_controller_1 = require("./cart.controller");
const middlewares_1 = require("../../middlewares");
const router = express_1.default.Router();
router.use(middlewares_1.authenticatedActionLimiter);
router.get('/', (0, middlewares_1.auth)('admin'), cart_controller_1.getAllCarts);
router.get('/me', (0, middlewares_1.auth)('user'), cart_controller_1.getMyCart);
router.get('/summary', (0, middlewares_1.auth)('user'), cart_controller_1.getCartSummary);
router.get('/:id', (0, middlewares_1.auth)('admin'), cart_controller_1.getCartById);
router.post('/add', (0, middlewares_1.auth)('user'), cart_controller_1.addToCart);
router.patch('/item/:productId', (0, middlewares_1.auth)('user'), cart_controller_1.updateCartItem);
router.delete('/item/:productId', (0, middlewares_1.auth)('user'), cart_controller_1.removeFromCart);
router.delete('/clear', (0, middlewares_1.auth)('user'), cart_controller_1.clearCart);
router.post('/checkout', (0, middlewares_1.auth)('user'), cart_controller_1.checkoutCart);
exports.cartRouter = router;
//# sourceMappingURL=cart.routes.js.map