import mongoose, { Schema } from 'mongoose';
import { IBlog } from './blog.interface';
import applyMongooseToJSON from '@/utils/mongooseToJSON';
import { generateUniqueSlug } from '@/utils/slugify';

const blogSchema = new Schema<IBlog>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, trim: true },
    content: { type: String, required: true },
    featuredImage: { type: String },
    tags: [{ type: String, trim: true }],
    isPublished: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

applyMongooseToJSON(blogSchema);

blogSchema.index({ isPublished: 1, isDeleted: 1, createdAt: -1 });
blogSchema.index({ slug: 1, isDeleted: 1 });

blogSchema.pre("validate", async function (next) {
  if (!this.slug && this.title) {
    this.slug = await generateUniqueSlug(this.title as any);
  }
  next();
});

export const Blog: mongoose.Model<IBlog> = mongoose.models.Blog || mongoose.model<IBlog>('Blog', blogSchema);