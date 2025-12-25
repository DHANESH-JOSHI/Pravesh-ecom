import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  _id: string;
  sequence: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, default: 0 },
  },
  {
    timestamps: false,
  }
);

export const Counter: mongoose.Model<ICounter> = 
  mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);

export async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const counterKey = `orderNumber_${year}_${month}_${day}`;

  const counter = await Counter.findByIdAndUpdate(
    { _id: counterKey },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );

  const sequence = String(counter.sequence).padStart(6, '0');
  return `ORD-${year}-${month}-${day}-${sequence}`;
}

