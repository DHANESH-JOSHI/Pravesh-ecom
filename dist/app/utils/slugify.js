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
exports.generateUniqueSlug = generateUniqueSlug;
const mongoose_1 = __importStar(require("mongoose"));
const slugify_1 = __importDefault(require("slugify"));
const slugCounterSchema = new mongoose_1.Schema({
    baseSlug: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
}, { timestamps: true });
const SlugCounter = mongoose_1.default.models.SlugCounter ||
    mongoose_1.default.model("SlugCounter", slugCounterSchema);
async function generateUniqueSlug(name) {
    const baseSlug = (0, slugify_1.default)(name, { lower: true, strict: true, trim: true });
    const counter = await SlugCounter.findOneAndUpdate({ baseSlug }, { $inc: { count: 1 } }, { new: true, upsert: true });
    if (counter.count === 1) {
        return baseSlug;
    }
    return `${baseSlug}-${counter.count - 1}`;
}
//# sourceMappingURL=slugify.js.map