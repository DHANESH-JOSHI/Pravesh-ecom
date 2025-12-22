"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageRouter = void 0;
const express_1 = __importDefault(require("express"));
const message_controller_1 = require("./message.controller");
const middlewares_1 = require("../../middlewares");
const router = express_1.default.Router();
router.post("/", message_controller_1.createMessage);
router.get("/", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, message_controller_1.listMessages);
router.get("/:id", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, message_controller_1.getMessageById);
router.patch("/:id/resolve", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, message_controller_1.resolveMessage);
router.delete("/:id", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, message_controller_1.deleteMessage);
exports.messageRouter = router;
//# sourceMappingURL=message.routes.js.map