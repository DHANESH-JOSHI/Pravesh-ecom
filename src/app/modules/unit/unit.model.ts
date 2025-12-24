import mongoose, { Schema } from "mongoose";
import { IUnit } from './unit.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';

const unitSchema = new Schema<IUnit>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

applyMongooseToJSON(unitSchema);

// Ensure unique name (case-insensitive) when not deleted
unitSchema.pre("save", async function (next) {
  if (this.isModified('name')) {
    const existingUnit = await Unit.findOne({ 
      name: { $regex: new RegExp(`^${this.name}$`, 'i') },
      isDeleted: false,
      _id: { $ne: this._id }
    });
    if (existingUnit) {
      return next(new Error('Unit with this name already exists'));
    }
  }
  next();
});

unitSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.name || update?.$set?.name) {
    const newName = update?.name || update?.$set?.name;
    const existingUnit = await Unit.findOne({ 
      name: { $regex: new RegExp(`^${newName}$`, 'i') },
      isDeleted: false,
      _id: { $ne: query._id }
    });
    if (existingUnit) {
      return next(new Error('Unit with this name already exists'));
    }
  }
  next();
});

unitSchema.pre("updateOne", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.name || update?.$set?.name) {
    const newName = update?.name || update?.$set?.name;
    const existingUnit = await Unit.findOne({ 
      name: { $regex: new RegExp(`^${newName}$`, 'i') },
      isDeleted: false,
      _id: { $ne: query._id }
    });
    if (existingUnit) {
      return next(new Error('Unit with this name already exists'));
    }
  }
  next();
});

export const Unit: mongoose.Model<IUnit> = mongoose.models.Unit || mongoose.model<IUnit>('Unit', unitSchema);

