import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import { IUser, UserRole, UserStatus } from "./user.interface";
import applyMongooseToJSON from "@/utils/mongooseToJSON";
import { cascadeUserDelete } from '@/utils/cascadeDelete';

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    img: { type: String },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.PENDING },
    otp: { type: String },
    otpExpires: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);
applyMongooseToJSON(userSchema);

userSchema.virtual("wallet", {
  ref: "Wallet",
  localField: "_id",
  foreignField: "user",
  justOne: true,
});

userSchema.virtual("cart", {
  ref: "Cart",
  localField: "_id",
  foreignField: "user",
  justOne: true,
});

userSchema.virtual("wishlist", {
  ref: "Wishlist",
  localField: "_id",
  foreignField: "user",
  justOne: true,
});

userSchema.virtual("orders", {
  ref: "Order",
  localField: "_id",
  foreignField: "user",
  justOne: false,
});

userSchema.virtual("addresses", {
  ref: "Address",
  localField: "_id",
  foreignField: "user",
  justOne: false,
  match: { isDeleted: false },
});

userSchema.virtual("reviews", {
  ref: "Review",
  localField: "_id",
  foreignField: "user",
  justOne: false,
});

userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.compareOtp = function (otp: string): boolean {
  return this.otp === otp && this.otpExpires && this.otpExpires > new Date();
};

userSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const userId = query._id;
    
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (user) {
      const session = this.getOptions().session || undefined;
      try {
        await cascadeUserDelete(userId as mongoose.Types.ObjectId, { session });
      } catch (error: any) {
        return next(error);
      }
    }
  }
  
  next();
});

userSchema.pre("updateOne", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const userId = query._id;
    
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (user) {
      const session = this.getOptions().session || undefined;
      try {
        await cascadeUserDelete(userId as mongoose.Types.ObjectId, { session });
      } catch (error: any) {
        return next(error);
      }
    }
  }
  
  next();
});

userSchema.pre("updateMany", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.isDeleted === true || update?.$set?.isDeleted === true) {
    const users = await User.find({ ...query, isDeleted: false });
    const session = this.getOptions().session;
    
    try {
      for (const user of users) {
        await cascadeUserDelete(user._id as mongoose.Types.ObjectId, { session: session || undefined });
      }
    } catch (error: any) {
      return next(error);
    }
  }
  
  next();
});

userSchema.pre("save", async function (next) {
  if (this.isModified("isDeleted") && this.isDeleted === true && !this.isNew) {
    const wasDeleted = await User.findById(this._id).select('isDeleted');
    if (wasDeleted && !wasDeleted.isDeleted) {
      try {
        await cascadeUserDelete(this._id as mongoose.Types.ObjectId);
      } catch (error: any) {
        return next(error);
      }
    }
  }
  
  next();
});

userSchema.index({ name: "text", phone: 1, email: "text" });
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ createdAt: -1 });

export const User: mongoose.Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
