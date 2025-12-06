"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingRouter = void 0;
const express_1 = __importDefault(require("express"));
const setting_controller_1 = require("./setting.controller");
const middlewares_1 = require("../../middlewares");
const router = express_1.default.Router();
router.get("/", setting_controller_1.getSettings);
router.patch("/", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, setting_controller_1.upsertSettings);
exports.settingRouter = router;
//# sourceMappingURL=setting.routes.js.map