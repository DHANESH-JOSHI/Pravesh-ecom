"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryRouter = void 0;
const express_1 = __importDefault(require("express"));
const category_controller_1 = require("./category.controller");
const middlewares_1 = require("../../middlewares");
const router = express_1.default.Router();
router.post('/', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, category_controller_1.createCategory);
router.get('/tree', category_controller_1.getCategoryTree);
router.get('/leaf', category_controller_1.getLeafCategories);
router.get('/', category_controller_1.getAllCategories);
router.get('/slug/:slug', category_controller_1.getCategoryBySlug);
router.get('/:id', category_controller_1.getCategoryById);
router.patch('/:id', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, category_controller_1.updateCategory);
router.delete('/:id', (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, category_controller_1.deleteCategory);
exports.categoryRouter = router;
//# sourceMappingURL=category.routes.js.map