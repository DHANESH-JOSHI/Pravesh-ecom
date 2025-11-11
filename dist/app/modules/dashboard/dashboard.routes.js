"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const middlewares_1 = require("../../middlewares");
const dashboard_controller_1 = require("./dashboard.controller");
const router = express_1.default.Router();
router.use((0, middlewares_1.auth)('admin'));
router.get('/stats', middlewares_1.authenticatedActionLimiter, dashboard_controller_1.getDashboardStats);
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map