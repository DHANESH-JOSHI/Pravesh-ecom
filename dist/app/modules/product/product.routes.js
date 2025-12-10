"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRouter = void 0;
const express_1 = __importDefault(require("express"));
const product_controller_1 = require("./product.controller");
const middlewares_1 = require("../../middlewares");
const middlewares_2 = require("../../middlewares");
const cloudinary_1 = require("../../config/cloudinary");
const router = express_1.default.Router();
router.post('/', (0, middlewares_1.auth)('admin'), middlewares_2.authenticatedActionLimiter, cloudinary_1.upload.single("thumbnail"), product_controller_1.createProduct);
router.get('/', (0, middlewares_1.optionalAuth)(), product_controller_1.getAllProducts);
router.get('/filters', product_controller_1.getProductFilters);
router.get('/slug/:slug', (0, middlewares_1.optionalAuth)(), product_controller_1.getProductBySlug);
router.get('/:id/related', (0, middlewares_1.optionalAuth)(), product_controller_1.getRelatedProducts);
router.get('/:id', (0, middlewares_1.optionalAuth)(), product_controller_1.getProductById);
router.patch('/:id', (0, middlewares_1.auth)('admin'), middlewares_2.authenticatedActionLimiter, cloudinary_1.upload.single("thumbnail"), product_controller_1.updateProduct);
router.delete('/:id', (0, middlewares_1.auth)('admin'), middlewares_2.authenticatedActionLimiter, product_controller_1.deleteProduct);
exports.productRouter = router;
//# sourceMappingURL=product.routes.js.map