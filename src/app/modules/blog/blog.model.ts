import { Schema, model } from 'mongoose';
import { IBlog } from './blog.interface';

const blogSchema = new Schema<IBlog>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    featuredImage: { type: String },
    tags: [{ type: String, trim: true }],
    isPublished: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret: any) {
        if (ret.createdAt && typeof ret.createdAt !== 'string') {
          ret.createdAt = new Date(ret.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
        if (ret.updatedAt && typeof ret.updatedAt !== 'string') {
          ret.updatedAt = new Date(ret.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        }
        return ret;
      }
    }
  }
);

blogSchema.index({ isPublished: 1, isDeleted: 1, createdAt: -1 });
blogSchema.index({ title: 'text', content: 'text' });

blogSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = this.title.toLowerCase().split(' ').join('-') + '-' + Date.now();
  }
  next();
});

export const Blog = model<IBlog>('Blog', blogSchema);