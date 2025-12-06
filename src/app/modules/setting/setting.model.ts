import mongoose, { Schema } from "mongoose";
import { ISetting } from "./setting.interface";

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

const SettingSchema = new Schema<ISetting>(
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
    workingHours: { type: String },
    citiesServed: { type: String },
    whyChooseUs: { type: String },
  },
  { timestamps: true }
);

export const Setting = mongoose.model<ISetting>("Setting", SettingSchema);
