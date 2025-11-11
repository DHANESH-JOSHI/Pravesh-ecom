import mongoose, { Schema } from 'mongoose';
import { IAddress } from './address.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';


const addressSchema = new Schema<IAddress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fullname: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    line1: {
      type: String,
      required: true,
    },
    line2: {
      type: String,
    },
    landmark: {
      type: String,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    postalCode: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

applyMongooseToJSON(addressSchema);

addressSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  const addressCount = await Address.countDocuments({ user: this.user });
  if (!this.isDefault && addressCount === 0) {
    this.isDefault = true;
  }
  next();
});

addressSchema.index({ fullname: 'text', phone: 'text', city: 'text', state: 'text', postalCode: 'text', country: 'text' });

addressSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'shippingAddress',
  justOne: false
})

addressSchema.index({ createdAt: -1 });

export const Address: mongoose.Model<IAddress> = mongoose.models.Address || mongoose.model<IAddress>('Address', addressSchema);