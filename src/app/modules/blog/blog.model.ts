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
blogSchema.index(
  { title: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false }
  }
);

blogSchema.pre("validate", async function (next) {
  if (this.isModified('title') || !this.slug) {
    if (this.title) {
      const excludeId = this._id ? String(this._id) : undefined;
      this.slug = await generateUniqueSlug(this.title as any, 'Blog', excludeId);
    }
  }
  next();
});

blogSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.title || update?.$set?.title) {
    const newTitle = update?.title || update?.$set?.title;
    if (newTitle) {
      const excludeId = query._id ? String(query._id) : undefined;
      const newSlug = await generateUniqueSlug(newTitle, 'Blog', excludeId);
      if (update.$set) {
        update.$set.slug = newSlug;
      } else {
        update.slug = newSlug;
      }
    }
  }
  
  next();
});

blogSchema.pre("updateOne", async function (next) {
  const update = this.getUpdate() as any;
  const query = this.getQuery();
  
  if (update?.title || update?.$set?.title) {
    const newTitle = update?.title || update?.$set?.title;
    if (newTitle) {
      const excludeId = query._id ? String(query._id) : undefined;
      const newSlug = await generateUniqueSlug(newTitle, 'Blog', excludeId);
      if (update.$set) {
        update.$set.slug = newSlug;
      } else {
        update.slug = newSlug;
      }
    }
  }
  
  next();
});

export const Blog: mongoose.Model<IBlog> = mongoose.models.Blog || mongoose.model<IBlog>('Blog', blogSchema);