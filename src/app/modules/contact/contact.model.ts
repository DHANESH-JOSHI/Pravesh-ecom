import mongoose, { Schema, Document } from "mongoose";

export type ContactStatus = "open" | "resolved";

export interface ContactDocument extends Document {
  name: string;
  email: string;
  subject?: string;
  message: string;
  status: ContactStatus;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<ContactDocument>(
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

export const Contact = mongoose.model<ContactDocument>("Contact", ContactSchema);
