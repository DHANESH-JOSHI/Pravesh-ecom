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
router.get('/', product_controller_1.getAllProducts);
router.get('/search', product_controller_1.searchProducts);
router.get('/featured', product_controller_1.getFeaturedProducts);
router.get('/new-arrivals', product_controller_1.getNewArrivalProducts);
// router.get('/discount', getDiscountProducts);
router.get('/filters', product_controller_1.getProductFilters);
router.get('/best-selling', product_controller_1.getBestSellingProducts);
router.get('/trending', product_controller_1.getTrendingProducts);
router.get('/slug/:slug', product_controller_1.getProductBySlug);
router.get('/category/:categoryId', product_controller_1.getProductsByCategory);
router.get('/:id', product_controller_1.getProductById);
router.patch('/:id', (0, middlewares_1.auth)('admin'), middlewares_2.authenticatedActionLimiter, cloudinary_1.upload.single("thumbnail"), product_controller_1.updateProduct);
router.delete('/:id', (0, middlewares_1.auth)('admin'), middlewares_2.authenticatedActionLimiter, product_controller_1.deleteProduct);
exports.productRouter = router;
//# sourceMappingURL=product.routes.js.map