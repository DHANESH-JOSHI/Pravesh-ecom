"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteContact = exports.resolveContact = exports.getContactById = exports.listContacts = exports.createContact = void 0;
const utils_1 = require("../../utils");
const contact_model_1 = require("./contact.model");
const contact_validation_1 = require("./contact.validation");
const interface_1 = require("../../interface");
const http_status_1 = __importDefault(require("http-status"));
const setting_model_1 = require("../setting/setting.model");
const ApiError = (0, interface_1.getApiErrorClass)("CONTACT");
const ApiResponse = (0, interface_1.getApiResponseClass)("CONTACT");
exports.createContact = (0, utils_1.asyncHandler)(async (req, res) => {
    const { name, email, subject, message } = contact_validation_1.createContactValidation.parse(req.body);
    const contact = await contact_model_1.Contact.create({ name, email, subject, message });
    const setting = await setting_model_1.Setting.findOne().select("email").lean();
    if (setting?.email) {
        await (0, utils_1.sendEmail)(setting.email, `New contact message: ${subject || "(no subject)"}`, `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
    }
    res.status(http_status_1.default.CREATED).json(new ApiResponse(http_status_1.default.CREATED, "Message received", { id: contact._id }));
    return;
});
exports.listContacts = (0, utils_1.asyncHandler)(async (req, res) => {
    const { page = 1, limit = 20, status: qStatus, isDeleted = false } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};
    if (qStatus)
        filter.status = qStatus;
    if (typeof isDeleted === "boolean")
        filter.isDeleted = isDeleted;
    else
        filter.isDeleted = false;
    const [items, total] = await Promise.all([
        contact_model_1.Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        contact_model_1.Contact.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / Number(limit));
    res.json(new ApiResponse(http_status_1.default.OK, "Contacts retrieved", { items, page: Number(page), limit: Number(limit), total, totalPages }));
    return;
});
exports.getContactById = (0, utils_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const contact = await contact_model_1.Contact.findOne({ _id: id, isDeleted: false });
    if (!contact)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Contact not found");
    res.json(new ApiResponse(http_status_1.default.OK, "Contact retrieved", contact));
    return;
});
exports.resolveContact = (0, utils_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const updated = await contact_model_1.Contact.findOneAndUpdate({ _id: id, isDeleted: false }, { status: "resolved" }, { new: true });
    if (!updated)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Contact not found");
    res.json(new ApiResponse(http_status_1.default.OK, "Contact marked as resolved", updated));
    return;
});
exports.deleteContact = (0, utils_1.asyncHandler)(async (req, res) => {
    const id = req.params.id;
    const deleted = await contact_model_1.Contact.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { new: true });
    if (!deleted)
        throw new ApiError(http_status_1.default.NOT_FOUND, "Contact not found");
    res.json(new ApiResponse(http_status_1.default.OK, "Contact deleted", deleted));
    return;
});
//# sourceMappingURL=contact.controller.js.map