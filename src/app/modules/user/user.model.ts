import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { IUser, UserRole, UserStatus } from './user.interface';

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    img: { type: String },
    role: { type: String, enum: UserRole, default: UserRole.USER },
    status: { type: String, enum: UserStatus, default: UserStatus.PENDING },
    otp: { type: String },
    otpExpires: { type: Date },
    isDeleted: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret: any) {
        if (ret.createdAt && typeof ret.createdAt !== 'string') {
          ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
        if (ret.updatedAt && typeof ret.updatedAt !== 'string') {
          ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
      }
    },
    toObject: {
      virtuals: true,
    }
  }
);

userSchema.virtual('wallet', {
  ref: 'Wallet',
  localField: '_id',
  foreignField: 'user',
  justOne: true,
});

userSchema.virtual('cart', {
  ref: 'Cart',
  localField: '_id',
  foreignField: 'user',
  justOne: true,
});

userSchema.virtual('wishlist', {
  ref: 'Wishlist',
  localField: '_id',
  foreignField: 'user',
  justOne: true,
});

userSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'user',
  justOne: false,
});

userSchema.virtual('addresses', {
  ref: 'Address',
  localField: '_id',
  foreignField: 'user',
  justOne: false,
});

userSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'user',
  justOne: false,
});

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

userSchema.methods.compareOtp = function (otp: string): boolean {
  return this.otp === otp && this.otpExpires && this.otpExpires > new Date();
};

userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', userSchema);
