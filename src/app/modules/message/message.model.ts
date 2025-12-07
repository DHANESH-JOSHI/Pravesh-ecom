import mongoose, { Schema } from "mongoose";
import { IMessage } from "./message.interface";
import applyMongooseToJSON from "@/utils/mongooseToJSON";

const messageSchema = new Schema<IMessage>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String },
    message: { type: String, required: true },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

applyMongooseToJSON(messageSchema);

messageSchema.index({ email: 1, name: 1, isDeleted: 1 });
messageSchema.index({ status: 1 });
messageSchema.index({ isDeleted: 1 });


export const Message = mongoose.model<IMessage>("Message", messageSchema);