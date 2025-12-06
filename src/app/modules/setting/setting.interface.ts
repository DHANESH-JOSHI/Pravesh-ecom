import { Document } from "mongoose";
export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  [key: string]: string | undefined;
}

export interface ISetting extends Document {
  businessName?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string;
  socialLinks?: SocialLinks;
  aboutTitle?: string;
  aboutDescription?: string;
  yearsOfExperience?: string;
  happyCustomers?: string;
  productsAvailable?: string;
  workingHours?: string;
  citiesServed?: string;
  whyChooseUs?: string;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}