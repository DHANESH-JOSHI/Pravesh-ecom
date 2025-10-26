import { Document } from "mongoose";

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active'
}

export interface IUser extends Document {
  name: string;
  img: string;
  password: string;
  status: UserStatus;
  phone: string;
  email?: string;
  role: UserRole;
  otp?: string;
  otpExpires?: Date;
  isDeleted: boolean;
  comparePassword(password: string): Promise<boolean>;
  compareOtp(otp: string): boolean;
}
