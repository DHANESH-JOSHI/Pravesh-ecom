import mongoose, { Schema } from "mongoose";
import { SettingDocument } from "./setting.interface";

const SocialLinksSchema = new Schema(
  {
    facebook: { type: String },
    twitter: { type: String },
    instagram: { type: String },
    linkedin: { type: String },
    youtube: { type: String },
  },
  { _id: false }
);

const SettingSchema = new Schema<SettingDocument>(
  {
    businessName: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    logo: { type: String },
    socialLinks: { type: SocialLinksSchema },
    aboutTitle: { type: String },
    aboutDescription: { type: String },
    yearsOfExperience: { type: String },
    happyCustomers: { type: String },
    productsAvailable: { type: String },
    citiesServed: { type: String },
    whyChooseUs: { type: String },
  },
  { timestamps: true }
);

export const Setting = mongoose.model<SettingDocument>("Setting", SettingSchema);
