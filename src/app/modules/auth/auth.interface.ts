import { Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  img: string;
  password: string;
  phone: string;
  email: string;
  role: 'admin' | 'vendor' | 'user';
  otp?: string;
  otpExpires?: Date;
  comparePassword(password: string): Promise<boolean>;
  compareOtp(otp: string): boolean;
}


