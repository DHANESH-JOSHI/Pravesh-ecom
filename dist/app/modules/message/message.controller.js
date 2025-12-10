"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMessage = exports.resolveMessage = exports.getMessageById = exports.listMessages = exports.createMessage = void 0;
const utils_1 = require("../../utils");
const message_model_1 = require("./message.model");
const message_validation_1 = require("./message.validation");
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const setting_model_1 = require("../setting/setting.model");
const redis_1 = require("../../config/redis");
const ApiError = (0, interface_1.getApiErrorClass)("CONTACT");
const ApiResponse = (0, interface_1.getApiResponseClass)("CONTACT");
exports.createMessage = (0, utils_1.asyncHandler)(async (req, res) => {
    const { name, email, subject, message } = message_validation_1.createMessageValidation.parse(req.body);
    const contact = await message_model_1.Message.create({ name, email, subject, message });
    const setting = await setting_model_1.Setting.findOne().select("email").lean();
    if (setting?.email) {
        await (0, utils_1.sendEmail)(setting.email, `New contact message: ${subject || "(no subject)"}`, `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
    }
    await redis_1.redis.deleteByPattern("messages*");
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, "Message received", { id: contact._id }));
    return;
});
exports.listMessages = (0, utils_1.asyncHandler)(async (req, res) => {
    const cacheKey = (0, utils_1.generateCacheKey)("messages", req.query);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached) {
        return res
            .status(http_status_1.default.OK)
            .json(new ApiResponse(http_status_1.default.OK, "Messages retrieved", cached));
    }
    const { page = 1, limit = 20, status: qStatus, search, isDeleted = false } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};
    if (qStatus)
        filter.status = qStatus;
    if (isDeleted == "true")
        filter.isDeleted = isDeleted;
    else
        filter.isDeleted = false;
    if (search) {
        const regex = new RegExp(search, "i");
        filter.$or = [
            { name: { $regex: regex } },
            { email: { $regex: regex } },
            { subject: { $regex: regex } },
            { message: { $regex: regex } },
        ];
    }
    const [items, total] = await Promise.all([
        message_model_1.Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        message_model_1.Message.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    const result = {
        messages: items,
        total,
        page: Number(page),
        totalPages,
    };
    await redis_1.redis.set(cacheKey, result, 3600);
    res.json(new ApiResponse(http_status_1.default.OK, "Messages retrieved", result));
    return;
});
exports.getMessageById = (0, utils_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const cachekey = `message:${id}`;
    const cached = await redis_1.redis.get(cachekey);
    if (cached) {
        return res.json(new ApiResponse(http_status_1.default.OK, "Message retrieved", cached));
    }
    const contact = await message_model_1.Message.findOne({ _id: id, isDeleted: false });
    if (!contact)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Message not found");
    await redis_1.redis.set(cachekey, contact, 3600);
    res.json(new ApiResponse(http_status_1.default.OK, "Message retrieved", contact));
    return;
});
exports.resolveMessage = (0, utils_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const updated = await message_model_1.Message.findOneAndUpdate({ _id: id, isDeleted: false }, { status: "resolved" }, { new: true });
    if (!updated)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Message not found");
    await redis_1.redis.delete(`message:${id}`);
    await redis_1.redis.deleteByPattern("messages*");
    res.json(new ApiResponse(http_status_1.default.OK, "Message marked as resolved", updated));
    return;
});
exports.deleteMessage = (0, utils_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const deleted = await message_model_1.Message.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { new: true });
    if (!deleted)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Message not found");
    await redis_1.redis.delete(`message:${id}`);
    await redis_1.redis.deleteByPattern("messages*");
    res.json(new ApiResponse(http_status_1.default.OK, "Message deleted", deleted));
    return;
});
//# sourceMappingURL=message.controller.js.map