"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactRouter = void 0;
const express_1 = __importDefault(require("express"));
const contact_controller_1 = require("./contact.controller");
const middlewares_1 = require("../../middlewares");
const router = express_1.default.Router();
router.post("/", contact_controller_1.createContact);
router.get("/", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, contact_controller_1.listContacts);
router.get("/:id", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, contact_controller_1.getContactById);
router.patch("/:id/resolve", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, contact_controller_1.resolveContact);
router.delete("/:id", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, contact_controller_1.deleteContact);
exports.contactRouter = router;
//# sourceMappingURL=contact.routes.js.map