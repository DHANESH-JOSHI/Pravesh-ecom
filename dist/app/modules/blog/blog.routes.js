"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.blogRouter = void 0;
const express_1 = __importDefault(require("express"));
const middlewares_1 = require("../../middlewares");
const blog_controller_1 = require("./blog.controller");
const cloudinary_1 = require("../../config/cloudinary");
const router = express_1.default.Router();
router.get('/', blog_controller_1.getAllBlogs);
router.get('/:id', blog_controller_1.getBlogById);
router.use((0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter);
router.post('/', cloudinary_1.upload.single('featuredImage'), blog_controller_1.createBlog);
router.patch('/:id', cloudinary_1.upload.single('featuredImage'), blog_controller_1.updateBlog);
router.delete('/:id', blog_controller_1.deleteBlog);
exports.blogRouter = router;
//# sourceMappingURL=blog.routes.js.map