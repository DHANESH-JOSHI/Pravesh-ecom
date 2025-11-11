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
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const user_interface_1 = require("./user.interface");
const mongooseToJSON_1 = __importDefault(require("../../utils/mongooseToJSON"));
const userSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    img: { type: String },
    role: { type: String, enum: user_interface_1.UserRole, default: user_interface_1.UserRole.USER },
    status: { type: String, enum: user_interface_1.UserStatus, default: user_interface_1.UserStatus.PENDING },
    otp: { type: String },
    otpExpires: { type: Date },
    isDeleted: { type: Boolean, default: false }
}, {
    timestamps: true,
});
(0, mongooseToJSON_1.default)(userSchema);
userSchema.virtual('wallet', {
    ref: 'Wallet',
    localField: '_id',
    foreignField: 'user',
    justOne: true,
});
userSchema.virtual('cart', {
    ref: 'Cart',
    localField: '_id',
    foreignField: 'user',
    justOne: true,
});
userSchema.virtual('wishlist', {
    ref: 'Wishlist',
    localField: '_id',
    foreignField: 'user',
    justOne: true,
});
userSchema.virtual('orders', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'user',
    justOne: false,
});
userSchema.virtual('addresses', {
    ref: 'Address',
    localField: '_id',
    foreignField: 'user',
    justOne: false,
    match: { isDeleted: false }
});
userSchema.virtual('reviews', {
    ref: 'Review',
    localField: '_id',
    foreignField: 'user',
    justOne: false,
});
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt_1.default.genSalt(10);
    this.password = await bcrypt_1.default.hash(this.password, salt);
    next();
});
userSchema.methods.comparePassword = async function (password) {
    return bcrypt_1.default.compare(password, this.password);
};
userSchema.methods.compareOtp = function (otp) {
    return this.otp === otp && this.otpExpires && this.otpExpires > new Date();
};
userSchema.index({ name: 'text', phone: 1, email: 'text' });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ createdAt: -1 });
exports.User = mongoose_1.default.models.User || mongoose_1.default.model('User', userSchema);
//# sourceMappingURL=user.model.js.map