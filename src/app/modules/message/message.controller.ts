import { asyncHandler, sendEmail } from "@/utils";
import { RedisKeys } from '@/utils/redisKeys';
import { CacheTTL } from "@/utils/cacheTTL";
import { Message } from "./message.model";
import { createMessageValidation } from "./message.validation";
import { getApiErrorClass, getApiResponseClass } from "@/interface";
import status from "http-status";
import { Setting } from "../setting/setting.model";
import { redis } from "@/config/redis";
import { RedisPatterns } from '@/utils/redisKeys';

const ApiError = getApiErrorClass("CONTACT");
const ApiResponse = getApiResponseClass("CONTACT");

export const createMessage = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = createMessageValidation.parse(req.body);

  const contact = await Message.create({ name, email, subject, message });
  const setting = await Setting.findOne().select("email").lean();
  if (setting?.email) {
    await sendEmail(
      setting.email,
      `New contact message: ${subject || "(no subject)"}`,
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    );
  }
  await redis.deleteByPattern(RedisPatterns.MESSAGES_ALL());
  res.status(status.CREATED).json(new ApiResponse(status.CREATED, "Message received", { id: contact._id }));
  return;
});

export const listMessages = asyncHandler(async (req, res) => {
  const cacheKey = RedisKeys.MESSAGES_LIST(req.query as Record<string, any>);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res
      .status(status.OK)
      .json(new ApiResponse(status.OK, "Messages retrieved", cached));
  }
  const { page = 1, limit = 20, status: qStatus, search, isDeleted = false } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter: any = {};
  if (qStatus) filter.status = qStatus;
  if (isDeleted == "true") filter.isDeleted = isDeleted;
  else filter.isDeleted = false;
  if (search) {
    const regex = new RegExp(search as string, "i");
    filter.$or = [
      { name: { $regex: regex } },
      { email: { $regex: regex } },
      { subject: { $regex: regex } },
      { message: { $regex: regex } },
    ];
  }

  const [items, total] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Message.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / Number(limit));
  const result = {
    messages: items,
    total,
    page: Number(page),
    totalPages,
  };

  await redis.set(cacheKey, result, CacheTTL.SHORT);

  res.json(new ApiResponse(status.OK, "Messages retrieved", result));
  return;
});

export const getMessageById = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const cachekey = RedisKeys.MESSAGE_BY_ID(id);
  const cached = await redis.get(cachekey);
  if (cached) {
    return res.json(new ApiResponse(status.OK, "Message retrieved", cached));
  }
  const contact = await Message.findOne({ _id: id, isDeleted: false });
  if (!contact) throw new ApiError(status.NOT_FOUND, "Message not found");
  const contactObj = (contact as any)?.toObject ? (contact as any).toObject() : contact;
  await redis.set(cachekey, contactObj, CacheTTL.LONG);
  res.json(new ApiResponse(status.OK, "Message retrieved", contact));
  return;
});

export const resolveMessage = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const updated = await Message.findOneAndUpdate({ _id: id, isDeleted: false }, { status: "resolved" }, { new: true });
  if (!updated) throw new ApiError(status.NOT_FOUND, "Message not found");
  await redis.delete(RedisKeys.MESSAGE_BY_ID(id));
  await redis.deleteByPattern(RedisPatterns.MESSAGES_ALL());
  res.json(new ApiResponse(status.OK, "Message marked as resolved", updated));
  return;
});

export const deleteMessage = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const deleted = await Message.findOneAndUpdate({ _id: id, isDeleted: false }, { isDeleted: true }, { new: true });
  if (!deleted) throw new ApiError(status.NOT_FOUND, "Message not found");
  await redis.delete(RedisKeys.MESSAGE_BY_ID(id));
  await redis.deleteByPattern(RedisPatterns.MESSAGES_ALL());
  res.json(new ApiResponse(status.OK, "Message deleted", deleted));
  return;
});
