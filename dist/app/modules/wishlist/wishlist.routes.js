"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wishlistRouter = void 0;
const express_1 = __importDefault(require("express"));
const middlewares_1 = require("../../middlewares");
const wishlist_controller_1 = require("./wishlist.controller");
const router = express_1.default.Router();
router.use((0, middlewares_1.auth)(), middlewares_1.authenticatedActionLimiter);
router.get('/', wishlist_controller_1.getWishlist);
router.post('/add', wishlist_controller_1.addProductToWishlist);
router.post('/remove', wishlist_controller_1.removeProductFromWishlist);
exports.wishlistRouter = router;
//# sourceMappingURL=wishlist.routes.js.map