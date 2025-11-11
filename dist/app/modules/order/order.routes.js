"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRouter = void 0;
const express_1 = __importDefault(require("express"));
const middlewares_1 = require("../../middlewares");
const cloudinary_1 = require("../../config/cloudinary");
const order_controller_1 = require("./order.controller");
const router = express_1.default.Router();
router.post('/', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, order_controller_1.createOrder);
router.post('/custom', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, cloudinary_1.upload.single('image'), order_controller_1.createCustomOrder);
router.post('/confirm/:id', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, order_controller_1.confirmCustomOrder);
router.get('/me', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, order_controller_1.getMyOrders);
router.get('/', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, order_controller_1.getAllOrders);
router.patch('/:id', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, order_controller_1.updateOrder);
router.patch('/:id/status', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, order_controller_1.updateOrderStatus);
router.patch('/:id/cancel', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, order_controller_1.cancelOrder);
router.get('/:id', (0, middlewares_1.auth)(), middlewares_1.authenticatedActionLimiter, order_controller_1.getOrderById);
exports.orderRouter = router;
//# sourceMappingURL=order.routes.js.map