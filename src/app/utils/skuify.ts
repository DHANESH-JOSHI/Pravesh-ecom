import mongoose, { Schema } from "mongoose";

const skuCounterSchema = new Schema(
  {
    prefix: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const SkuCounter =
  mongoose.models.SkuCounter || mongoose.model("SkuCounter", skuCounterSchema);

export async function generateUniqueSKU(prefix = "SKU", length = 5): Promise<string> {
  const counter = await SkuCounter.findOneAndUpdate(
    { prefix },
    { $inc: { count: 1 } },
    { new: true, upsert: true }
  );

  const paddedNumber = String(counter.count).padStart(length, "0");
  return `${prefix}-${paddedNumber}`;
}
