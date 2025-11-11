"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = __importDefault(require("express"));
const user_controller_1 = require("./user.controller");
const middlewares_1 = require("../../middlewares");
const router = express_1.default.Router();
router.get("/me", (0, middlewares_1.auth)(), middlewares_1.authenticatedActionLimiter, user_controller_1.getMe);
router.post("/phone/:phone", middlewares_1.dataCheckLimiter, user_controller_1.checkPhoneExists);
router.post("/email/:email", middlewares_1.dataCheckLimiter, user_controller_1.checkEmailExists);
router.get("/", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, user_controller_1.getAllUsers);
router.post("/", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, user_controller_1.createUser);
router.get("/:id", (0, middlewares_1.auth)(), middlewares_1.authenticatedActionLimiter, user_controller_1.getUserById);
router.post("/:id/recover", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, user_controller_1.recoverUser);
router.delete("/:id", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, user_controller_1.deleteUser);
router.patch("/password", (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, user_controller_1.updatePassword);
router.patch("/", (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, user_controller_1.updateUser);
router.post('/password/reset', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, user_controller_1.resetPassword);
exports.userRouter = router;
//# sourceMappingURL=user.routes.js.map