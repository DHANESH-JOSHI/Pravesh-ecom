import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

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



const userSchema: Schema = new Schema(
  {
    name: { type: String },
    password: { type: String },
    phone: { type: String, required: true },
    email: { type: String },
    img: { type: String },
    role: { type: String, enum: ['admin', 'vendor', 'user'], default: 'user' },
    status: { type: String, enum: ['pending', 'active'], default: 'active' },
    otp: { type: String },
    otpExpires: { type: Date },
  },
  { timestamps: true }
);


userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

// Add method to compare OTP
userSchema.methods.compareOtp = function (otp: string): boolean {
  return this.otp === otp && this.otpExpires && this.otpExpires > new Date();
};


// Add index for phone
userSchema.index({ phone: 1 }, { unique: true });

export const User = mongoose.model<IUser>('User', userSchema);
