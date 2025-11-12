"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandRouter = void 0;
const express_1 = __importDefault(require("express"));
const brand_controller_1 = require("./brand.controller");
const cloudinary_1 = require("../../config/cloudinary");
const middlewares_1 = require("../../middlewares");
const router = express_1.default.Router();
router.post('/', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, cloudinary_1.upload.single('image'), brand_controller_1.createBrand);
router.get('/', brand_controller_1.getAllBrands);
router.get('/:id', brand_controller_1.getBrandById);
router.get('/slug/:slug', brand_controller_1.getBrandBySlug);
router.patch('/:id', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, cloudinary_1.upload.single('image'), brand_controller_1.updateBrand);
router.delete('/:id', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, brand_controller_1.deleteBrand);
exports.brandRouter = router;
//# sourceMappingURL=brand.routes.js.map