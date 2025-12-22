"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRouter = void 0;
const express_1 = __importDefault(require("express"));
const middlewares_1 = require("../../middlewares");
const review_controller_1 = require("./review.controller");
const router = express_1.default.Router();
router.get('/', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, review_controller_1.getAllReviews);
router.get('/me', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, review_controller_1.getMyReviews);
router.get('/:id', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, review_controller_1.getReviewById);
router.get('/product/:productId', review_controller_1.getProductReviews);
router.post('/', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, review_controller_1.createReview);
router.patch('/:id', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, review_controller_1.updateReview);
router.delete('/:id', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, review_controller_1.deleteReview);
exports.reviewRouter = router;
//# sourceMappingURL=review.routes.js.map