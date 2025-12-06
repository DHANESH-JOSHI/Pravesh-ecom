import mongoose, { Schema } from "mongoose";
import { IContact } from "./contact.interface";

const ContactSchema = new Schema<IContact>(
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

export const Contact = mongoose.model<IContact>("Contact", ContactSchema);
