import { asyncHandler, sendEmail } from "@/utils";
import { Contact } from "./contact.model";
import { createContactValidation } from "./contact.validation";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import status from "http-status";
import { Setting } from "../setting/setting.model";

const ApiError = getApiErrorClass("CONTACT");
const ApiResponse = getApiResponseClass("CONTACT");

export const createContact = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = createContactValidation.parse(req.body);

  const contact = await Contact.create({ name, email, subject, message });
  const setting = await Setting.findOne().select("email").lean();
  if (setting?.email) {
    await sendEmail(
      setting.email,
      `New contact message: ${subject || "(no subject)"}`,
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    );
  }
  res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Message received", { id: contact._id }));
  return;
});

export const listContacts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status: qStatus, isDeleted = false } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (qStatus) filter.status = qStatus;
  if (typeof isDeleted === "boolean") filter.isDeleted = isDeleted;
  else filter.isDeleted = false;

  const [items, total] = await Promise.all([
    Contact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Contact.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  res.json(new ApiResponse(status.OK, "Contacts retrieved", { items, page: Number(page), limit: Number(limit), total, totalPages }));
  return;
});

export const getContactById = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const contact = await Contact.findOne({ _id: id, isDeleted: false });
  if (!contact) throw new ApiError(status.NOT_FOUND, "Contact not found");
  res.json(new ApiResponse(status.OK, "Contact retrieved", contact));
  return;
});

export const resolveContact = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const updated = await Contact.findOneAndUpdate({ _id: id, isDeleted: false }, { status: "resolved" }, { new: true });
  if (!updated) throw new ApiError(status.NOT_FOUND, "Contact not found");
  res.json(new ApiResponse(status.OK, "Contact marked as resolved", updated));
  return;
});

export const deleteContact = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const deleted = await Contact.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { new: true });
  if (!deleted) throw new ApiError(status.NOT_FOUND, "Contact not found");
  res.json(new ApiResponse(status.OK, "Contact deleted", deleted));
  return;
});
