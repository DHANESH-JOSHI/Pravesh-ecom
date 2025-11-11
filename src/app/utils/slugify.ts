import mongoose, { Schema } from "mongoose";
import slugify from "slugify";

const slugCounterSchema = new Schema(
  {
    baseSlug: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const SlugCounter =
  mongoose.models.SlugCounter ||
  mongoose.model("SlugCounter", slugCounterSchema);

export async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = slugify(name, { lower: true, strict: true, trim: true });

  const counter = await SlugCounter.findOneAndUpdate(
    { baseSlug },
    { $inc: { count: 1 } },
    { new: true, upsert: true }
  );

  if (counter.count === 1) {
    return baseSlug;
  }

  return `${baseSlug}-${counter.count - 1}`;
}
