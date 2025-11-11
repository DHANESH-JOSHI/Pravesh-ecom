"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressRouter = void 0;
const express_1 = __importDefault(require("express"));
const address_controller_1 = require("./address.controller");
const middlewares_1 = require("../../middlewares");
const router = express_1.default.Router();
router.get("/", (0, middlewares_1.auth)('admin'), middlewares_1.authenticatedActionLimiter, address_controller_1.getAllAddresses);
router.get("/me", (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, address_controller_1.getMyAddresses);
router.get('/:id', (0, middlewares_1.auth)(), middlewares_1.authenticatedActionLimiter, address_controller_1.getAddressById);
router.post("/", (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, address_controller_1.createAddress);
router.patch('/:id/default', (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, address_controller_1.setDefaultAddress);
router.patch("/:id", (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, address_controller_1.updateMyAddress);
router.delete("/:id", (0, middlewares_1.auth)('user'), middlewares_1.authenticatedActionLimiter, address_controller_1.deleteMyAddress);
exports.addressRouter = router;
//# sourceMappingURL=address.routes.js.map