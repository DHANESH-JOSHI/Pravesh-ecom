"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Banner = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const banner_interface_1 = require("./banner.interface");
const mongooseToJSON_1 = __importDefault(require("../../utils/mongooseToJSON"));
const bannerSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    image: { type: String, required: true },
    targetUrl: { type: String },
    type: {
        type: String,
        enum: Object.values(banner_interface_1.BannerType),
        required: true,
    },
    targetId: { type: mongoose_1.Schema.Types.ObjectId },
    isDeleted: { type: Boolean, default: true },
    order: { type: Number, default: 0, index: true },
}, {
    timestamps: true,
});
(0, mongooseToJSON_1.default)(bannerSchema);
bannerSchema.index({ type: 1 });
bannerSchema.index({ createdAt: -1, isDeleted: 1 });
exports.Banner = mongoose_1.default.models.Banner || mongoose_1.default.model('Banner', bannerSchema);
//# sourceMappingURL=banner.model.js.map