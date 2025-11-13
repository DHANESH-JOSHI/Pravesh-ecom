"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bannerRouter = void 0;
const express_1 = __importDefault(require("express"));
const banner_controller_1 = require("./banner.controller");
const middlewares_1 = require("../../middlewares");
const cloudinary_1 = require("../../config/cloudinary");
const router = express_1.default.Router();
router.get('/', banner_controller_1.getAllBanners);
router.get('/:id', banner_controller_1.getBannerById);
router.use((0, middlewares_1.auth)('admin'));
router.post('/', middlewares_1.authenticatedActionLimiter, cloudinary_1.upload.single('image'), banner_controller_1.createBanner);
router.patch('/:id', middlewares_1.authenticatedActionLimiter, cloudinary_1.upload.single('image'), banner_controller_1.updateBanner);
router.delete('/:id', middlewares_1.authenticatedActionLimiter, banner_controller_1.deleteBanner);
exports.bannerRouter = router;
//# sourceMappingURL=banner.routes.js.map