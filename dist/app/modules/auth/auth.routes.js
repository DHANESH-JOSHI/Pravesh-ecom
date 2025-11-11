"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../auth/auth.controller");
const middlewares_1 = require("../../middlewares");
const router = express_1.default.Router();
router.post("/register", middlewares_1.authLimiter, auth_controller_1.registerUser);
router.post("/login", middlewares_1.authLimiter, auth_controller_1.loginUser);
router.post("/admin-login", middlewares_1.authLimiter, auth_controller_1.loginAsAdmin);
router.post("/otp/request", middlewares_1.smsLimiter, auth_controller_1.requestForOtp);
router.post("/otp-login", middlewares_1.authLimiter, auth_controller_1.loginUsingOtp);
router.post("/admin-otp-login", middlewares_1.authLimiter, auth_controller_1.loginAsAdminUsingOtp);
router.post("/refresh-tokens", middlewares_1.authLimiter, auth_controller_1.refreshTokens);
router.post("/logout", middlewares_1.authLimiter, auth_controller_1.logout);
exports.authRouter = router;
//# sourceMappingURL=auth.routes.js.map