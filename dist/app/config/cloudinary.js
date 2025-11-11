"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = exports.cloudinary = void 0;
const cloudinary_1 = require("cloudinary");
Object.defineProperty(exports, "cloudinary", { enumerable: true, get: function () { return cloudinary_1.v2; } });
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const multer_1 = __importDefault(require("multer"));
const config_1 = __importDefault(require("../config"));
const logger_1 = require("./logger");
cloudinary_1.v2.config({
    cloud_name: config_1.default.CLOUDINARY_CLOUD_NAME,
    api_key: config_1.default.CLOUDINARY_API_KEY,
    api_secret: config_1.default.CLOUDINARY_API_SECRET
});
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: {
        folder: (req, file) => {
            let folderName = 'pravesh-uploads';
            if (req.originalUrl.includes('/products')) {
                folderName = 'pravesh-products';
                // } else if (req.originalUrl.includes('/categories')) {
                //   folderName = 'pravesh-categories';
            }
            else if (req.originalUrl.includes('/brands')) {
                folderName = 'pravesh-brands';
            }
            else if (req.originalUrl.includes('/orders')) {
                folderName = 'pravesh-orders';
            }
            else if (req.originalUrl.includes('/blogs')) {
                folderName = 'pravesh-blogs';
            }
            else if (req.originalUrl.includes('/banners')) {
                folderName = 'pravesh-banners';
            }
            logger_1.logger.info(`[CLOUDINARY]: ${file.originalname} (${file.mimetype}) uploaded to folder: ${folderName}`);
            return folderName;
        },
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'],
        transformation: [{ width: 1200, height: 600, crop: 'limit' }]
    }
});
const upload = (0, multer_1.default)({ storage });
exports.upload = upload;
//# sourceMappingURL=cloudinary.js.map